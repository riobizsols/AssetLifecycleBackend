#!/usr/bin/env bash
#
# Enable PgBouncer for ALM main backend (web.rioassetmanagement.net).
# Rewrites app URLs to alm_pgbouncer:6432 and keeps POSTGRES_DIRECT_URL for admin/DDL.
#
# Usage (on rio-server):
#   cd ~/alm-main/AssetLifecycleBackend
#   chmod +x scripts/db/enable-pgbouncer-main.sh
#   ./scripts/db/enable-pgbouncer-main.sh
#   node scripts/db/render-pgbouncer-config.js
#   docker compose -f docker-compose.pgbouncer.yml up -d
#   ./deploy-docker.sh --rebuild
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env.production"

PGBOUNCER_HOST="${PGBOUNCER_HOST:-alm_pgbouncer}"
PGBOUNCER_PORT="${PGBOUNCER_PORT:-6432}"
POSTGRES_DIRECT_HOST="${POSTGRES_DIRECT_HOST:-alm_db}"
POSTGRES_DIRECT_PORT="${POSTGRES_DIRECT_PORT:-5432}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found"
  exit 1
fi

upsert_kv() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

rewrite_url_host_port() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 || true)"
  if [[ -z "$line" ]]; then
    echo "WARN: ${key} not found in ${ENV_FILE} — skip"
    return
  fi
  local url="${line#*=}"
  local new_url
  new_url="$(node -e "
    const u = new URL(process.argv[1]);
    u.hostname = process.argv[2];
    u.port = process.argv[3];
    if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'disable');
    console.log(u.toString());
  " "$url" "$PGBOUNCER_HOST" "$PGBOUNCER_PORT")"
  upsert_kv "$key" "$new_url"
}

# Preserve direct Postgres URL from current DATABASE_URL before rewrite
CURRENT_DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
if [[ -n "$CURRENT_DB_URL" ]]; then
  DIRECT_URL="$(node -e "
    const u = new URL(process.argv[1]);
    u.hostname = process.argv[2];
    u.port = process.argv[3];
    if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'disable');
    console.log(u.toString());
  " "$CURRENT_DB_URL" "$POSTGRES_DIRECT_HOST" "$POSTGRES_DIRECT_PORT")"
  upsert_kv "POSTGRES_DIRECT_URL" "$DIRECT_URL"
fi

upsert_kv "PGBOUNCER_ENABLED" "true"
upsert_kv "PGBOUNCER_HOST" "$PGBOUNCER_HOST"
upsert_kv "PGBOUNCER_PORT" "$PGBOUNCER_PORT"
upsert_kv "POSTGRES_DIRECT_HOST" "$POSTGRES_DIRECT_HOST"
upsert_kv "POSTGRES_DIRECT_PORT" "$POSTGRES_DIRECT_PORT"

rewrite_url_host_port "DATABASE_URL"
rewrite_url_host_port "TENANT_DATABASE_URL"
rewrite_url_host_port "GENERIC_URL"

# Smaller Node pools — PgBouncer holds real Postgres connections
upsert_kv "DB_POOL_MAX" "${DB_POOL_MAX:-10}"
upsert_kv "DB_POOL_MIN" "${DB_POOL_MIN:-0}"
upsert_kv "TENANT_REGISTRY_POOL_MAX" "${TENANT_REGISTRY_POOL_MAX:-5}"
upsert_kv "TENANT_DB_POOL_MAX" "${TENANT_DB_POOL_MAX:-3}"

echo "✅ PgBouncer enabled in ${ENV_FILE}"
echo "   App traffic → ${PGBOUNCER_HOST}:${PGBOUNCER_PORT}"
echo "   Admin/DDL   → ${POSTGRES_DIRECT_HOST}:${POSTGRES_DIRECT_PORT}"
echo ""
echo "Next:"
echo "  node scripts/db/render-pgbouncer-config.js"
echo "  docker compose -f docker-compose.pgbouncer.yml up -d"
echo "  node scripts/db/migrate-tenants-to-pgbouncer.js   # if tenants use alm_db"
echo "  ./deploy-docker.sh --rebuild"
