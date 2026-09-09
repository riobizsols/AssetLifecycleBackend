#!/usr/bin/env bash
# Apply max_connections increase (pending until Postgres restart).
#
# Usage:
#   ./scripts/db/increase-max-connections.sh
#   MAX_CONNECTIONS=250 ./scripts/db/increase-max-connections.sh
#
# Then on the DB host restart Postgres (Docker example):
#   docker restart alm_db

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  # Load only DB URLs without sourcing whole .env (avoids spaces in secrets)
  GENERIC_URL="$(grep -E '^GENERIC_URL=' .env | head -1 | cut -d= -f2-)"
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2-)"
fi

DB_URL="${GENERIC_URL:-${DATABASE_URL:-}}"
# Strip optional surrounding quotes
DB_URL="${DB_URL%\"}"
DB_URL="${DB_URL#\"}"
DB_URL="${DB_URL%\'}"
DB_URL="${DB_URL#\'}"

if [[ -z "${DB_URL}" ]]; then
  echo "Missing GENERIC_URL / DATABASE_URL"
  exit 1
fi

MAX_CONNECTIONS="${MAX_CONNECTIONS:-200}"

echo "Setting max_connections=${MAX_CONNECTIONS} (requires restart)..."
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
ALTER SYSTEM SET max_connections = ${MAX_CONNECTIONS};
SELECT name, setting, pending_restart
FROM pg_settings
WHERE name = 'max_connections';
SQL

echo
echo "Pending change written. Restart Postgres to apply, then run: SHOW max_connections;"
echo "  docker restart alm_db"
