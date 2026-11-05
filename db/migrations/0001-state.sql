-- Progress sync (app-platform record 0042): one JSON document per person,
-- the app's localStorage DB without its per-device keys (sync.js). Served by
-- the platform's PostgREST, which exposes only schema "api":
--
--   GET  /api/rpc/get_state                      -> {"doc": {...} | null, "version": n}
--   POST /api/rpc/put_state {"doc", "version"}   -> {"status": "ok", "version": n+1}
--                                                 | {"status": "conflict", "doc", "version"}
--
-- PostgREST verifies the Pocket ID access token (signature, expiry, aud =
-- this app's client) and runs each request as the runtime role with the
-- token's claims in request.jwt.claims. A person is the token's (iss, sub).

CREATE TABLE IF NOT EXISTS state (
  issuer      text NOT NULL,
  subject     text NOT NULL,
  doc         jsonb NOT NULL,
  version     integer NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issuer, subject)
);

-- The caller's (iss, sub); none -> HTTP 401.
CREATE OR REPLACE FUNCTION public.caller(OUT iss text, OUT sub text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  c jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
BEGIN
  iss := nullif(c->>'iss', '');
  sub := nullif(c->>'sub', '');
  IF iss IS NULL OR sub IS NULL THEN
    RAISE SQLSTATE 'PT401' USING MESSAGE = 'Sign-in required';
  END IF;
END
$$;

-- Each person reaches only their own row, whatever the query.
ALTER TABLE state ENABLE ROW LEVEL SECURITY;
ALTER TABLE state FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS state_owner ON state;
CREATE POLICY state_owner ON state
  USING ((issuer, subject) = (SELECT iss, sub FROM public.caller()))
  WITH CHECK ((issuer, subject) = (SELECT iss, sub FROM public.caller()));

CREATE SCHEMA IF NOT EXISTS api;
REVOKE ALL ON SCHEMA api FROM PUBLIC;

CREATE OR REPLACE FUNCTION api.get_state() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object('doc', doc, 'version', version) FROM state),
    jsonb_build_object('doc', null, 'version', 0))
  FROM public.caller()
$$;

-- Saves doc if the stored version is still "version" (0 = nothing stored yet).
CREATE OR REPLACE FUNCTION api.put_state(doc jsonb, version integer) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  me record := public.caller();
  v_new integer;
  cur record;
BEGIN
  IF jsonb_typeof(doc) IS DISTINCT FROM 'object' THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE = 'doc must be a JSON object';
  END IF;
  IF pg_column_size(doc) > 4 * 1024 * 1024 THEN
    RAISE SQLSTATE 'PT413' USING MESSAGE = 'doc is larger than 4 MiB';
  END IF;
  IF version = 0 THEN
    INSERT INTO state (issuer, subject, doc, version) VALUES (me.iss, me.sub, put_state.doc, 1)
    ON CONFLICT (issuer, subject) DO NOTHING
    RETURNING state.version INTO v_new;
  ELSE
    UPDATE state SET doc = put_state.doc, version = state.version + 1, updated_at = now()
    WHERE state.version = put_state.version
    RETURNING state.version INTO v_new;
  END IF;
  IF v_new IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'ok', 'version', v_new);
  END IF;
  SELECT state.doc, state.version INTO cur FROM state;
  RETURN jsonb_build_object('status', 'conflict', 'doc', cur.doc, 'version', coalesce(cur.version, 0));
END
$$;

-- === Runtime role grants (the role PostgREST runs as) ===
REVOKE ALL ON FUNCTION public.caller(), api.get_state(), api.put_state(jsonb, integer) FROM PUBLIC;
DO $$
DECLARE
  rt text := nullif(current_setting('app.runtime_role', true), '');
BEGIN
  IF rt IS NULL THEN
    RETURN;
  END IF;
  EXECUTE format('GRANT USAGE ON SCHEMA api TO %I', rt);
  EXECUTE format('GRANT EXECUTE ON FUNCTION public.caller(), api.get_state(), api.put_state(jsonb, integer) TO %I', rt);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE ON state TO %I', rt);
END
$$;
