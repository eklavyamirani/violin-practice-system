#!/bin/sh
# Database image of a PostgREST app (app-platform record 0042; copied from
# templates/postgrest-db/). The platform runs it as the database owner:
#
#   migrate.sh migrate   before each deploy: apply migrations/*.sql in name
#                        order, each once and in its own transaction
#   migrate.sh fixture   preview seed only, after migrate: fixture.sql
#
# Env: DATABASE_URL (owner), DATABASE_RUNTIME_ROLE (the role PostgREST runs
# as; SQL reads it as current_setting('app.runtime_role')), DB_DIR (default
# /db: migrations/, fixture.sql). A migration
# that was applied is never edited: a changed checksum stops the deploy.
set -eu
: "${DATABASE_URL:?DATABASE_URL is required}"
dir=${DB_DIR:-/db}
export PGOPTIONS="-c app.runtime_role=${DATABASE_RUNTIME_ROLE:-}"
sql() { psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

case ${1:-} in
migrate)
  sql -c "CREATE TABLE IF NOT EXISTS platform_migrations (
            name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())"
  for f in "$dir"/migrations/*.sql; do
    [ -e "$f" ] || { echo "no migrations in $dir/migrations" >&2; exit 1; }
    name=$(basename "$f")
    sum=$(sha256sum "$f" | cut -d' ' -f1)
    have=$(sql -tAc "SELECT sha256 FROM platform_migrations WHERE name = '$name'")
    if [ -n "$have" ]; then
      [ "$have" = "$sum" ] || { echo "migration $name was changed after it was applied" >&2; exit 1; }
      continue
    fi
    sql -1 -f "$f" -c "INSERT INTO platform_migrations (name, sha256) VALUES ('$name', '$sum')"
    echo "applied $name"
  done
  # PostgREST reloads its schema cache (it also restarts on each release).
  sql -c "NOTIFY pgrst, 'reload schema'"
  echo "migrations up to date"
  ;;
fixture)
  sql -1 -f "$dir/fixture.sql"
  echo "fixture applied"
  ;;
*)
  echo "usage: migrate.sh migrate|fixture" >&2
  exit 2
  ;;
esac
