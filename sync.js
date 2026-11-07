// Sync across devices (app-platform record 0046). When the app is served by
// the app platform, /runtime-config.json names the sign-in (Pocket ID) and
// progress is kept in the platform's database as one document per person,
// behind PostgREST (db/migrations). Elsewhere (GitHub Pages, a local
// http.server) there is no runtime config and the app stays offline-only.
//
// localStorage stays the app's own store, so practice works offline. Sync
// pulls on start, pushes a few seconds after each save, and on a version
// conflict merges three ways against the last synced copy: changes made on
// both devices are kept. Settings and the selected drill stay per device.
(function (root) {
  "use strict";

  // ---------- Three-way merge (pure; node test/sync.test.js) ----------
  const LOCAL_ONLY = ["settings", "selected"];
  const CAPS = { sessions: 60, pieces: 10 }; // the app's own list limits
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  // Key order doesn't matter (the server's jsonb reorders keys).
  const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(",")}]`
    : isObj(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`
    : JSON.stringify(v === undefined ? null : v));
  const same = (a, b) => canon(a) === canon(b);
  // Numbers both devices added to: keep both additions.
  const isCounter = (p) =>
    (p.length === 1 && p[0] === "xp") || (p.length === 2 && p[0] === "days") ||
    (p.length === 3 && p[0] === "notes" && (p[2] === "n" || p[2] === "wrong")) ||
    (p.length === 4 && p[0] === "planLog" && p[2] === "secs"); // practice plan: seconds per step and day
  const recordId = (x) => (isObj(x) ? (x.id !== undefined ? "id:" + x.id : x.t !== undefined ? "t:" + x.t : undefined) : undefined);

  function mergeLists(base, a, b, path) {
    const all = [...a, ...b];
    // Plain lists (e.g. a note's last 20 landings): this device's wins.
    if (!all.every((x) => recordId(x) !== undefined)) return a;
    const index = (l) => new Map((l || []).map((x) => [recordId(x), x]));
    const O = index(Array.isArray(base) ? base : []), A = index(a), B = index(b);
    const out = [], seen = new Set();
    for (const x of all) {
      const id = recordId(x);
      if (seen.has(id)) continue;
      seen.add(id);
      const inA = A.has(id), inB = B.has(id);
      if (inA && inB) out.push(merge3(O.get(id), A.get(id), B.get(id), path.concat(id)));
      // Present on one side only: new there, or deleted on the other side (drop it
      // unless the side that kept it also changed it).
      else if (!O.has(id) || !same(O.get(id), inA ? A.get(id) : B.get(id))) out.push(inA ? A.get(id) : B.get(id));
    }
    if (out.every((x) => typeof x.t === "number")) out.sort((x, y) => y.t - x.t);
    const cap = path.length === 1 ? CAPS[path[0]] : undefined;
    return cap ? out.slice(0, cap) : out;
  }

  // merge3(base, mine, theirs): base = the copy both last agreed on.
  function merge3(base, a, b, path = []) {
    if (same(a, b)) return a;
    if (same(base, a)) return b;
    if (same(base, b)) return a;
    if (typeof a === "number" && typeof b === "number") {
      if (isCounter(path)) return a + b - (typeof base === "number" ? base : 0);
      if (path[path.length - 1] === "best") return Math.max(a, b);
      return a;
    }
    if (Array.isArray(a) && Array.isArray(b)) return mergeLists(base, a, b, path);
    if (isObj(a) && isObj(b)) {
      const o = isObj(base) ? base : {}, out = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const inA = k in a, inB = k in b;
        if (inA && inB) out[k] = merge3(o[k], a[k], b[k], path.concat(k));
        else {
          // Deleted on one side: gone, unless the other side changed it since.
          const kept = inA ? a[k] : b[k];
          if (!(k in o) || !same(o[k], kept)) out[k] = kept;
        }
      }
      return out;
    }
    return a;
  }

  // The synced part of the app's DB.
  function shared(db) {
    const out = {};
    for (const k of Object.keys(db || {})) if (!LOCAL_ONLY.includes(k)) out[k] = db[k];
    return out;
  }

  const api = { merge3, shared, LOCAL_ONLY };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }

  // ---------- Browser: sign-in and sync ----------
  const AUTH_KEY = "fingerboard-coach.auth", SYNC_KEY = "fingerboard-coach.sync";
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let cfg = null, disco = null, app = null, timer = null, busy = false, again = false;
  let status = { state: "off", text: "" };
  const listeners = [];
  const setStatus = (state, text) => { status = { state, text }; listeners.forEach((f) => f(status)); };

  const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const random = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const claims = (jwt) => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch (e) { return {}; } };

  async function discovery() {
    if (!disco) {
      const r = await fetch(`${cfg.oidcAuthority}/.well-known/openid-configuration`);
      if (!r.ok) throw new Error(`sign-in service: ${r.status}`);
      disco = await r.json();
    }
    return disco;
  }
  async function tokenRequest(params) {
    const { token_endpoint } = await discovery();
    const r = await fetch(token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: cfg.oidcClientId, ...params }) });
    if (!r.ok) throw new Error(`sign-in: ${r.status}`);
    const t = await r.json();
    const prev = read(AUTH_KEY) || {};
    const auth = { access: t.access_token, refresh: t.refresh_token || prev.refresh, id: t.id_token || prev.id, exp: claims(t.access_token).exp || 0 };
    write(AUTH_KEY, auth);
    return auth;
  }
  async function signIn() {
    const { authorization_endpoint } = await discovery();
    const verifier = random(32), state = random(16);
    sessionStorage.setItem("fbc.oidc", JSON.stringify({ verifier, state }));
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    location.href = `${authorization_endpoint}?${new URLSearchParams({ response_type: "code", client_id: cfg.oidcClientId, redirect_uri: cfg.oidcRedirectUri, scope: "openid profile email", code_challenge: challenge, code_challenge_method: "S256", state })}`;
  }
  // Back from the sign-in page with ?code&state: exchange the code (PKCE).
  async function finishSignIn() {
    const q = new URLSearchParams(location.search);
    const code = q.get("code"), state = q.get("state");
    if (!code || !state) return;
    const saved = JSON.parse(sessionStorage.getItem("fbc.oidc") || "{}");
    sessionStorage.removeItem("fbc.oidc");
    ["code", "state", "iss"].forEach((k) => q.delete(k));
    history.replaceState({}, "", location.pathname + (q.toString() ? `?${q}` : "") + location.hash);
    if (!saved.state || saved.state !== state) throw new Error("sign-in: state mismatch");
    await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: cfg.oidcRedirectUri, code_verifier: saved.verifier });
  }
  function signOut() { write(AUTH_KEY, null); setStatus("signedOut", ""); }
  const signedIn = () => !!(read(AUTH_KEY) || {}).access;
  const who = () => { const a = read(AUTH_KEY) || {}; const c = claims(a.id || a.access || ""); return c.preferred_username || c.email || c.name || ""; };

  async function token(force) {
    let a = read(AUTH_KEY);
    if (!a) return null;
    if (force || a.exp - 30 < Date.now() / 1000) {
      if (!a.refresh) { signOut(); return null; }
      try { a = await tokenRequest({ grant_type: "refresh_token", refresh_token: a.refresh }); } catch (e) { signOut(); return null; }
    }
    return a.access;
  }
  async function rpc(name, body) {
    for (let i = 0; i < 2; i++) {
      const t = await token(i > 0);
      if (!t) throw new Error("signed out");
      const r = await fetch(`api/rpc/${name}`, body === undefined
        ? { headers: { Authorization: `Bearer ${t}` } }
        : { method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (r.status === 401 && i === 0) continue;
      if (!r.ok) throw new Error(`sync: ${r.status}`);
      return r.json();
    }
    throw new Error("sync: 401");
  }

  // One round: pull, merge, push until the server has our merged copy.
  async function syncNow() {
    if (!cfg || !signedIn()) return;
    if (busy) { again = true; return; }
    if (!app.idle()) { schedule(); return; } // never swap data under a running drill
    busy = true; setStatus("syncing", "Syncing…");
    try {
      const sub = claims((read(AUTH_KEY) || {}).access || "").sub;
      let st = read(SYNC_KEY);
      if (!st || st.sub !== sub) st = { sub, version: 0, base: null };
      let remote = await rpc("get_state");
      for (let round = 0; round < 4; round++) {
        const local = shared(app.get());
        const merged = merge3(st.base, local, remote.doc || {});
        if (!same(merged, local)) app.set(merged);
        if (remote.doc && same(merged, remote.doc)) { st = { sub, version: remote.version, base: remote.doc }; break; }
        const r = await rpc("put_state", { doc: merged, version: remote.version });
        if (r.status === "ok") { st = { sub, version: r.version, base: merged }; break; }
        remote = { doc: r.doc, version: r.version }; // someone else saved first: merge again
      }
      write(SYNC_KEY, st);
      setStatus("synced", `Synced ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    } catch (e) {
      setStatus(signedIn() ? "error" : "signedOut", signedIn() ? (navigator.onLine ? `Sync failed (${e.message})` : "Offline: will sync later") : "");
    } finally {
      busy = false;
      if (again) { again = false; schedule(); }
    }
  }
  function schedule(ms = 4000) { clearTimeout(timer); timer = setTimeout(syncNow, ms); }

  // app: { get(): DB, set(sharedDoc), idle(): bool }
  async function start(appHooks) {
    app = appHooks;
    try {
      const r = await fetch("runtime-config.json", { cache: "no-store" });
      const c = r.ok ? await r.json() : null;
      if (c && c.oidcAuthority && c.oidcClientId && c.oidcRedirectUri) cfg = c;
    } catch (e) {}
    if (!cfg) { setStatus("off", ""); return; }
    try { await finishSignIn(); } catch (e) { setStatus("error", e.message); }
    if (!signedIn()) { setStatus("signedOut", ""); return; }
    syncNow();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schedule(500); else syncNow(); });
    addEventListener("online", () => schedule(500));
  }

  root.Sync = Object.assign(api, {
    start, signIn, signOut, signedIn, who, syncNow,
    changed: () => { if (cfg && signedIn()) schedule(); },
    onStatus: (f) => { listeners.push(f); f(status); },
    enabled: () => !!cfg,
  });
})(this);
