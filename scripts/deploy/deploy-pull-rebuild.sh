#!/usr/bin/env bash
#
# Safe Docker deploy: stash → git pull → stash pop → rebuild container(s).
# Lives in AssetLifecycleBackend repo so it is pushed with backend git.
#
# Run from server (typical layout ~/alm-main/AssetLifecycleBackend + WebFrontend):
#   ./deploy-docker.sh              # backend container only
#   ./deploy-docker.sh --all        # backend + frontend
#   ./deploy-docker.sh --rebuild    # rebuild only, no git pull
#
# From frontend repo:
#   ./deploy-docker.sh              # frontend container only
#
# See scripts/deploy/README.md
#

set -euo pipefail

_DEPLOY_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$(cd "${_DEPLOY_SCRIPT_DIR}/../.." && pwd)}"
ALM_ROOT="${ALM_ROOT:-$(cd "${BACKEND_DIR}/.." && pwd)}"
FRONTEND_DIR="${FRONTEND_DIR:-${ALM_ROOT}/AssetLifecycleWebFrontend}"

BACKEND_CONTAINER_NAME="${BACKEND_CONTAINER_NAME:-alm-main-backend}"
FRONTEND_CONTAINER_NAME="${FRONTEND_CONTAINER_NAME:-alm-main-frontend}"

BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-5002}"
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-3002}"

SKIP_GIT_PULL="${SKIP_GIT_PULL:-0}"
GIT_STASH="${GIT_STASH:-1}"
BACKEND_ONLY="${BACKEND_ONLY:-0}"
FRONTEND_ONLY="${FRONTEND_ONLY:-0}"
ENSURE_ALM_SHARED="${ENSURE_ALM_SHARED:-1}"
ALM_SHARED_NETWORK="${ALM_SHARED_NETWORK:-alm-shared}"
ENSURE_MINIO_NETWORK="${ENSURE_MINIO_NETWORK:-1}"
ENSURE_MINIO_ENV="${ENSURE_MINIO_ENV:-1}"
ENSURE_MINIO_BUCKET="${ENSURE_MINIO_BUCKET:-1}"
MINIO_DOCKER_NETWORK="${MINIO_DOCKER_NETWORK:-mansoor-s-app-backend_mansoor-net}"
MINIO_CONTAINER="${MINIO_CONTAINER:-mansoor-minio}"
# Defaults match rio-server mansoor-minio; override via env if MinIO credentials change.
MINIO_END_POINT_VALUE="${MINIO_END_POINT_VALUE:-mansoor-minio}"
MINIO_PORT_VALUE="${MINIO_PORT_VALUE:-9000}"
MINIO_USE_SSL_VALUE="${MINIO_USE_SSL_VALUE:-false}"
MINIO_ACCESS_KEY_VALUE="${MINIO_ACCESS_KEY_VALUE:-minioadmin}"
MINIO_SECRET_KEY_VALUE="${MINIO_SECRET_KEY_VALUE:-minioadmin123}"
# Separate buckets: main vs tenant vs pressana (override with MINIO_BUCKET_VALUE)
if [[ -z "${MINIO_BUCKET_VALUE:-}" ]]; then
  if [[ "${BACKEND_CONTAINER_NAME}" == "alm-tenant-backend" ]]; then
    MINIO_BUCKET_VALUE="alm-tenant"
  elif [[ "${BACKEND_CONTAINER_NAME}" == "alm-pressana-backend" ]]; then
    MINIO_BUCKET_VALUE="alm-pressana"
  else
    MINIO_BUCKET_VALUE="alm-main"
  fi
fi
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-alm_db}"
REDIS_CONTAINER="${REDIS_CONTAINER:-alm_redis}"
PRESSANA_DB_NAME="${PRESSANA_DB_NAME:-demopressana_db}"
PRESSANA_PUBLIC_URL="${PRESSANA_PUBLIC_URL:-https://pressanaorg.rioassetmanagement.net}"
PRESSANA_APP_PORT="${PRESSANA_APP_PORT:-5001}"
PRESSANA_REDIS_URL="${PRESSANA_REDIS_URL:-redis://alm_redis:6379/0}"
PRESSANA_RESERVED_SUBDOMAINS="${PRESSANA_RESERVED_SUBDOMAINS:-web,www,api,pressanaorg}"
FORCE_COMPOSE_RECREATE="${FORCE_COMPOSE_RECREATE:-1}"
HEALTH_WAIT_SECS="${HEALTH_WAIT_SECS:-90}"
STASH_MESSAGE_PREFIX="${STASH_MESSAGE_PREFIX:-auto-stash before deploy}"

log() { printf '%s\n' "$*"; }

die() { log "ERROR: $*"; exit 1; }

detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  die "Neither 'docker compose' nor 'docker-compose' found. Install docker-compose-plugin or docker-compose."
}

compose_version_line() {
  local cmd="$1"
  if [[ "$cmd" == "docker compose" ]]; then
    docker compose version 2>/dev/null | head -1 || true
  else
    docker-compose version --short 2>/dev/null || docker-compose version 2>/dev/null | head -1 || true
  fi
}

compose_v1_remove_container_if_exists() {
  local cmd="$1"
  local cname="$2"
  if [[ "$cmd" != "docker-compose" ]]; then
    return
  fi
  local id
  while read -r id; do
    [[ -z "$id" ]] && continue
    log "Removing container ${id} (name filter: ${cname}; avoids docker-compose 1.29.x recreate bug)..."
    docker rm -f "$id" || true
  done < <(docker ps -aq --filter "name=${cname}" 2>/dev/null)
}

repo_has_local_changes() {
  local dir="$1"
  [[ -n "$(cd "$dir" && git status --porcelain 2>/dev/null)" ]]
}

# .env / .env.production often conflict on stash pop. Reset them to HEAD so
# stash/pull can proceed; ensure_minio_env_files re-applies MinIO values later.
clear_env_merge_conflicts() {
  local label="${1:-repo}"
  local unmerged
  unmerged="$(git diff --name-only --diff-filter=U 2>/dev/null || true)"
  if [[ -z "$unmerged" ]]; then
    return 0
  fi

  log "[$label] Unmerged paths detected — clearing env merge conflicts..."
  printf '%s\n' "$unmerged"

  # Backup whatever is on disk before resetting
  [[ -f .env ]] && cp -a .env ".env.bak.$(date -u +%Y%m%d%H%M%S)" 2>/dev/null || true
  [[ -f .env.production ]] && cp -a .env.production ".env.production.bak.$(date -u +%Y%m%d%H%M%S)" 2>/dev/null || true

  # Prefer committed/HEAD versions; fall back to deleting index conflict entries
  git checkout HEAD -- .env .env.production 2>/dev/null || true
  git add -- .env .env.production 2>/dev/null || true

  # If still unmerged (file only existed on one side), reset the index entry
  if git diff --name-only --diff-filter=U 2>/dev/null | grep -qE '^\.env'; then
    git reset HEAD -- .env .env.production 2>/dev/null || true
    git checkout -- .env .env.production 2>/dev/null || true
    git add -- .env .env.production 2>/dev/null || true
  fi

  if git diff --name-only --diff-filter=U 2>/dev/null | grep -qE '^\.env'; then
    die "[$label] Could not clear .env merge conflicts. Run: git checkout HEAD -- .env .env.production && git add .env .env.production"
  fi

  log "[$label] Env merge conflicts cleared (backups: .env.bak.* if present)"
}

# Backup server .env files, reset tracked copies so git pull can proceed,
# then restore the backup after pull (server secrets win over remote template).
preserve_env_across_pull() {
  local label="${1:-repo}"
  local ts
  ts="$(date -u +%Y%m%d%H%M%S)"
  ENV_PULL_BACKUP_DIR=""

  if [[ ! -f .env && ! -f .env.production ]]; then
    return 0
  fi

  ENV_PULL_BACKUP_DIR=".env-pull-backup.${ts}"
  mkdir -p "$ENV_PULL_BACKUP_DIR"
  [[ -f .env ]] && cp -a .env "$ENV_PULL_BACKUP_DIR/.env"
  [[ -f .env.production ]] && cp -a .env.production "$ENV_PULL_BACKUP_DIR/.env.production"
  log "[$label] Backed up env files → ${ENV_PULL_BACKUP_DIR}/"

  # Drop local modifications so pull is not blocked (excludes from stash leave these dirty)
  git checkout HEAD -- .env .env.production 2>/dev/null || true
}

restore_env_after_pull() {
  local label="${1:-repo}"
  [[ -n "${ENV_PULL_BACKUP_DIR:-}" && -d "$ENV_PULL_BACKUP_DIR" ]] || return 0

  log "[$label] Restoring server env files from ${ENV_PULL_BACKUP_DIR}/"
  [[ -f "$ENV_PULL_BACKUP_DIR/.env" ]] && cp -a "$ENV_PULL_BACKUP_DIR/.env" .env
  [[ -f "$ENV_PULL_BACKUP_DIR/.env.production" ]] && cp -a "$ENV_PULL_BACKUP_DIR/.env.production" .env.production
  # Keep one dated bak alongside; remove temp dir to avoid clutter growth
  [[ -f .env.production ]] && cp -a .env.production ".env.production.bak.${ENV_PULL_BACKUP_DIR##*.}" 2>/dev/null || true
  rm -rf "$ENV_PULL_BACKUP_DIR"
  ENV_PULL_BACKUP_DIR=""
}

git_pull_with_stash() {
  local dir="$1"
  local label="${2:-$(basename "$dir")}"
  [[ -d "$dir/.git" ]] || die "Not a git repo: $dir"

  if [[ "$SKIP_GIT_PULL" == "1" ]]; then
    log "SKIP_GIT_PULL=1 — skipping git pull in $label ($dir)"
    return
  fi

  (
    cd "$dir" || exit 1
    local stashed=0
    local ENV_PULL_BACKUP_DIR=""

    # Stuck mid-merge from a previous failed stash pop blocks all git stash/pull
    clear_env_merge_conflicts "$label"

    # Always preserve server .env* then reset tracked copies before stash/pull
    preserve_env_across_pull "$label"

    if [[ "$GIT_STASH" == "1" ]] && repo_has_local_changes "$dir"; then
      log "[$label] Local changes detected — stashing (including untracked)..."
      # Never stash .env* — they are server secrets and cause recurring merge conflicts
      if ! git stash push -u -m "${STASH_MESSAGE_PREFIX} $(date -u +%Y-%m-%dT%H:%M:%SZ)" -- . ':(exclude).env' ':(exclude).env.production'; then
        log "[$label] WARN: pathspec stash failed — trying full stash after resetting env files"
        clear_env_merge_conflicts "$label"
        git checkout HEAD -- .env .env.production 2>/dev/null || true
        git stash push -u -m "${STASH_MESSAGE_PREFIX} $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      fi
      stashed=1
    elif repo_has_local_changes "$dir"; then
      log "[$label] WARN: local changes present but GIT_STASH=0 — pull may fail or merge"
    else
      log "[$label] Working tree clean — pulling latest..."
    fi

    log "[$label] git pull"
    git pull

    restore_env_after_pull "$label"

    if [[ "$stashed" == "1" ]]; then
      log "[$label] git stash pop — restoring local changes..."
      if ! git stash pop; then
        log "[$label] WARN: stash pop had conflicts — auto-resolving .env / .env.production"
        clear_env_merge_conflicts "$label"
        log "[$label] Env conflict auto-resolved (MinIO settings will be re-applied next)"
        log "[$label] Remaining stash (if any): git stash list"
      else
        log "[$label] Local changes restored after pull"
      fi
    fi
  )
}

container_is_running() {
  local name="$1"
  [[ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo false)" == "true" ]]
}

wait_for_http() {
  local port="$1"
  local label="$2"
  local path="${3:-/}"
  local url="http://127.0.0.1:${port}${path}"
  local elapsed=0
  local interval=2

  log "[$label] Waiting for HTTP ${url} (up to ${HEALTH_WAIT_SECS}s)..."
  while [[ "$elapsed" -lt "$HEALTH_WAIT_SECS" ]]; do
    if curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null | grep -qE '^[23]'; then
      log "[$label] HTTP health OK (${url})"
      return 0
    fi
    sleep "$interval"
    elapsed=$((elapsed + interval))
  done
  return 1
}

verify_container_health() {
  local container_name="$1"
  local host_port="$2"
  local label="$3"

  if ! container_is_running "$container_name"; then
    die "[$label] Container ${container_name} is not running after compose up"
  fi
  log "[$label] Container ${container_name} is running"

  if ! wait_for_http "$host_port" "$label"; then
    log "[$label] WARN: HTTP check failed on port ${host_port} — showing last 30 log lines:"
    docker logs --tail=30 "$container_name" 2>&1 || true
    die "[$label] Health check failed on port ${host_port}"
  fi
}

is_pressana_stack() {
  [[ "${BACKEND_CONTAINER_NAME}" == "alm-pressana-backend" ]] \
    || [[ "${FRONTEND_CONTAINER_NAME}" == "alm-pressana-frontend" ]] \
    || [[ "${COMPOSE_PROJECT_NAME:-}" == "pressana-alm" ]]
}

ensure_alm_shared_network() {
  if [[ "$ENSURE_ALM_SHARED" != "1" ]]; then
    log "ENSURE_ALM_SHARED=0 — skipping shared Docker network setup"
    return
  fi
  log "Ensuring Docker network ${ALM_SHARED_NETWORK} and attaching ${POSTGRES_CONTAINER} / ${REDIS_CONTAINER}..."
  docker network create "$ALM_SHARED_NETWORK" 2>/dev/null || true
  local c
  for c in "$POSTGRES_CONTAINER" "$REDIS_CONTAINER"; do
    if docker inspect "$c" >/dev/null 2>&1; then
      docker network connect "$ALM_SHARED_NETWORK" "$c" 2>/dev/null \
        || log "Note: ${c} likely already on ${ALM_SHARED_NETWORK} (OK)."
    else
      log "WARN: container ${c} not found — start it or set POSTGRES_CONTAINER / REDIS_CONTAINER."
    fi
  done
}

upsert_env_kv() {
  local file="$1"
  local key="$2"
  local value="$3"
  [[ -f "$file" ]] || touch "$file"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "${file}.bak"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

# Keep user/password/host; only rewrite the database name (hospitality → demopressana_db).
rewrite_database_url_dbname() {
  local file="$1"
  local dbname="$2"
  [[ -f "$file" ]] || return 0
  grep -qE '^DATABASE_URL=' "$file" 2>/dev/null || return 0
  sed -i.bak -E "s|^(DATABASE_URL=postgresql://[^[:space:]/]+/)[^/?#]+|\1${dbname}|" "$file" && rm -f "${file}.bak"
}

# Pressana stack must never inherit main-ALM hospitality / port 5000 / web.rioassetmanagement.net.
ensure_pressana_backend_env() {
  local dir="${1:-$BACKEND_DIR}"
  is_pressana_stack || return 0

  local f
  for f in "${dir}/.env.production" "${dir}/.env"; do
    [[ -f "$f" || "$f" == "${dir}/.env.production" ]] || continue
    log "Ensuring Pressana backend env in $(basename "$f") (db=${PRESSANA_DB_NAME}, port=${PRESSANA_APP_PORT})"
    upsert_env_kv "$f" "PORT" "$PRESSANA_APP_PORT"
    upsert_env_kv "$f" "FRONTEND_URL" "$PRESSANA_PUBLIC_URL"
    upsert_env_kv "$f" "BACKEND_URL" "$PRESSANA_PUBLIC_URL"
    upsert_env_kv "$f" "API_BASE_URL" "${PRESSANA_PUBLIC_URL}/api"
    upsert_env_kv "$f" "RESERVED_SUBDOMAINS" "$PRESSANA_RESERVED_SUBDOMAINS"
    upsert_env_kv "$f" "REDIS_URL" "$PRESSANA_REDIS_URL"
    upsert_env_kv "$f" "CACHE_ENABLED" "true"
    rewrite_database_url_dbname "$f" "$PRESSANA_DB_NAME"
  done
}

ensure_pressana_frontend_env() {
  local dir="${1:-$FRONTEND_DIR}"
  is_pressana_stack || return 0

  local f
  for f in "${dir}/.env.production" "${dir}/.env"; do
    [[ -f "$f" || "$f" == "${dir}/.env.production" ]] || continue
    log "Ensuring Pressana frontend env in $(basename "$f")"
    upsert_env_kv "$f" "VITE_API_BASE_URL" "${PRESSANA_PUBLIC_URL}/api"
    upsert_env_kv "$f" "VITE_FRONTEND_URL" "$PRESSANA_PUBLIC_URL"
    upsert_env_kv "$f" "VITE_RESERVED_SUBDOMAINS" "$PRESSANA_RESERVED_SUBDOMAINS"
  done
}

# Force correct MinIO settings into .env.production (and .env) before compose recreate.
# Prevents git pull/stash from restoring the dead 103.27.234.248 / wrong keys.
ensure_minio_env_files() {
  local dir="${1:-$BACKEND_DIR}"

  if [[ "$ENSURE_MINIO_ENV" != "1" ]]; then
    log "ENSURE_MINIO_ENV=0 — skipping MinIO env patch"
    return
  fi

  upsert_minio_kv() {
    local file="$1"
    local key="$2"
    local value="$3"
    [[ -f "$file" ]] || touch "$file"
    if grep -qE "^${key}=" "$file" 2>/dev/null; then
      # portable in-place replace
      sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "${file}.bak"
    else
      printf '\n%s=%s\n' "$key" "$value" >> "$file"
    fi
  }

  local f
  for f in "${dir}/.env.production" "${dir}/.env"; do
    [[ -f "$f" || "$f" == "${dir}/.env.production" ]] || continue
    log "Ensuring MinIO settings in $(basename "$f") (endpoint=${MINIO_END_POINT_VALUE}, bucket=${MINIO_BUCKET_VALUE})"
    upsert_minio_kv "$f" "MINIO_END_POINT" "$MINIO_END_POINT_VALUE"
    upsert_minio_kv "$f" "MINIO_PORT" "$MINIO_PORT_VALUE"
    upsert_minio_kv "$f" "MINIO_USE_SSL" "$MINIO_USE_SSL_VALUE"
    upsert_minio_kv "$f" "MINIO_ACCESS_KEY" "$MINIO_ACCESS_KEY_VALUE"
    upsert_minio_kv "$f" "MINIO_SECRET_KEY" "$MINIO_SECRET_KEY_VALUE"
    upsert_minio_kv "$f" "MINIO_BUCKET" "$MINIO_BUCKET_VALUE"
    # Strip leftover conflict markers if any
    sed -i.bak '/^<<<<<<< /d;/^=======/d;/^>>>>>>> /d' "$f" 2>/dev/null && rm -f "${f}.bak" || true
  done
}

# Join MinIO's Docker network so MINIO_END_POINT=mansoor-minio resolves after recreate.
# Prefer compose `mansoor-net` external network; this is a safety net if compose attach fails.
ensure_minio_network() {
  local container_name="${1:-$BACKEND_CONTAINER_NAME}"

  if [[ "$ENSURE_MINIO_NETWORK" != "1" ]]; then
    log "ENSURE_MINIO_NETWORK=0 — skipping MinIO Docker network attach"
    return
  fi

  if ! docker network inspect "$MINIO_DOCKER_NETWORK" >/dev/null 2>&1; then
    log "WARN: MinIO network ${MINIO_DOCKER_NETWORK} not found — start ${MINIO_CONTAINER} first, or set ENSURE_MINIO_NETWORK=0"
    return
  fi

  if ! docker inspect "$container_name" >/dev/null 2>&1; then
    log "WARN: container ${container_name} not found — cannot attach to MinIO network"
    return
  fi

  log "Ensuring ${container_name} is on MinIO network ${MINIO_DOCKER_NETWORK}..."
  if docker network connect "$MINIO_DOCKER_NETWORK" "$container_name" 2>/dev/null; then
    log "Attached ${container_name} → ${MINIO_DOCKER_NETWORK}"
  else
    log "Note: ${container_name} likely already on ${MINIO_DOCKER_NETWORK} (OK)."
  fi

  if docker inspect "$MINIO_CONTAINER" >/dev/null 2>&1; then
    if docker exec "$container_name" node -e "
      const http=require('http');
      const req=http.get('http://${MINIO_CONTAINER}:9000/minio/health/live', res=>{
        process.exit(res.statusCode===200?0:1);
      });
      req.on('error', ()=>process.exit(1));
      req.setTimeout(4000, ()=>{ req.destroy(); process.exit(1); });
    " >/dev/null 2>&1; then
      log "MinIO health OK from ${container_name} → ${MINIO_CONTAINER}:9000"
    else
      log "WARN: MinIO reachability check failed from ${container_name} (check MINIO_END_POINT / networks)"
    fi
  else
    log "WARN: MinIO container ${MINIO_CONTAINER} not running"
  fi
}

# Create the stack-specific bucket if missing (alm-main / alm-tenant).
ensure_minio_bucket() {
  local container_name="${1:-$BACKEND_CONTAINER_NAME}"

  if [[ "$ENSURE_MINIO_BUCKET" != "1" ]]; then
    log "ENSURE_MINIO_BUCKET=0 — skipping bucket ensure"
    return
  fi

  if ! docker inspect "$container_name" >/dev/null 2>&1; then
    log "WARN: container ${container_name} not found — cannot ensure MinIO bucket"
    return
  fi

  log "Ensuring MinIO bucket exists for ${container_name}..."
  if docker exec "$container_name" node -e "
    const Minio = require('minio');
    const c = new Minio.Client({
      endPoint: process.env.MINIO_END_POINT,
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: String(process.env.MINIO_USE_SSL || '').toLowerCase() === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });
    const bucket = process.env.MINIO_BUCKET;
    if (!bucket) { console.error('MINIO_BUCKET unset'); process.exit(1); }
    c.bucketExists(bucket).then(async (exists) => {
      if (!exists) {
        await c.makeBucket(bucket);
        console.log('created ' + bucket);
      } else {
        console.log('exists ' + bucket);
      }
    }).catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
  "; then
    log "MinIO bucket ensure OK"
  else
    log "WARN: MinIO bucket ensure failed — check keys / network / MINIO_BUCKET"
  fi
}

compose_up() {
  local dir="$1"
  local label="$2"
  local cmd
  cmd="$(detect_compose)"
  # Isolate stacks that share the same directory basename (AssetLifecycleBackend)
  if [[ -z "${COMPOSE_PROJECT_NAME:-}" ]]; then
    if [[ "${BACKEND_CONTAINER_NAME}" == "alm-pressana-backend" ]] || [[ "${FRONTEND_CONTAINER_NAME}" == "alm-pressana-frontend" ]]; then
      export COMPOSE_PROJECT_NAME="pressana-alm"
    elif [[ "${BACKEND_CONTAINER_NAME}" == "alm-tenant-backend" ]] || [[ "${FRONTEND_CONTAINER_NAME}" == "alm-tenant-web" ]]; then
      export COMPOSE_PROJECT_NAME="tenant-alm"
    fi
  fi
  export COMPOSE_IGNORE_ORPHANS="${COMPOSE_IGNORE_ORPHANS:-1}"
  local extra=()
  if [[ "$FORCE_COMPOSE_RECREATE" == "1" ]]; then
    extra+=(--force-recreate)
  fi
  log "Compose ($label): cd $dir && COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-default} $cmd up -d --build ${extra[*]}"
  ( cd "$dir" && $cmd up -d --build "${extra[@]}" )
  ( cd "$dir" && $cmd ps -a )
}

main() {
  local compose_cmd
  compose_cmd="$(detect_compose)"
  log "Using: $(compose_version_line "$compose_cmd")"
  log "ALM_ROOT=$ALM_ROOT"
  log "BACKEND_DIR=$BACKEND_DIR"
  log "FRONTEND_DIR=$FRONTEND_DIR"

  if [[ "$FRONTEND_ONLY" == "1" && "$BACKEND_ONLY" == "1" ]]; then
    die "Set only one of BACKEND_ONLY=1 or FRONTEND_ONLY=1"
  fi

  if [[ "$FRONTEND_ONLY" != "1" ]]; then
    [[ -d "$BACKEND_DIR" ]] || die "Backend directory missing: $BACKEND_DIR"
    git_pull_with_stash "$BACKEND_DIR" "backend"
    ensure_minio_env_files "$BACKEND_DIR"
    ensure_pressana_backend_env "$BACKEND_DIR"
    ensure_alm_shared_network
    compose_v1_remove_container_if_exists "$compose_cmd" "$BACKEND_CONTAINER_NAME"
    if is_pressana_stack; then
      docker rm -f "$BACKEND_CONTAINER_NAME" 2>/dev/null || true
    fi
    compose_up "$BACKEND_DIR" "backend"
    verify_container_health "$BACKEND_CONTAINER_NAME" "$BACKEND_HOST_PORT" "backend"
    ensure_minio_network "$BACKEND_CONTAINER_NAME"
    ensure_minio_bucket "$BACKEND_CONTAINER_NAME"
  fi

  if [[ "$BACKEND_ONLY" != "1" ]]; then
    [[ -d "$FRONTEND_DIR" ]] || die "Frontend directory missing: $FRONTEND_DIR"
    git_pull_with_stash "$FRONTEND_DIR" "frontend"
    ensure_pressana_frontend_env "$FRONTEND_DIR"
    compose_v1_remove_container_if_exists "$compose_cmd" "$FRONTEND_CONTAINER_NAME"
    compose_up "$FRONTEND_DIR" "frontend"
    verify_container_health "$FRONTEND_CONTAINER_NAME" "$FRONTEND_HOST_PORT" "frontend"
  fi

  log "Deploy complete. Public URL: ensure nginx proxies /api → 127.0.0.1:${BACKEND_HOST_PORT}"
}

main "$@"
