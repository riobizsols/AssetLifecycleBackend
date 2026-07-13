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
# Separate buckets: main vs tenant (override with MINIO_BUCKET_VALUE)
if [[ -z "${MINIO_BUCKET_VALUE:-}" ]]; then
  if [[ "${BACKEND_CONTAINER_NAME}" == "alm-tenant-backend" ]]; then
    MINIO_BUCKET_VALUE="alm-tenant"
  else
    MINIO_BUCKET_VALUE="alm-main"
  fi
fi
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-alm_db}"
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

    if [[ "$GIT_STASH" == "1" ]] && repo_has_local_changes "$dir"; then
      log "[$label] Local changes detected — stashing (including untracked)..."
      git stash push -u -m "${STASH_MESSAGE_PREFIX} $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      stashed=1
    elif repo_has_local_changes "$dir"; then
      log "[$label] WARN: local changes present but GIT_STASH=0 — pull may fail or merge"
    else
      log "[$label] Working tree clean — pulling latest..."
    fi

    log "[$label] git pull"
    git pull

    if [[ "$stashed" == "1" ]]; then
      log "[$label] git stash pop — restoring local changes..."
      if ! git stash pop; then
        log "[$label] WARN: stash pop had conflicts — auto-resolving .env / .env.production"
        # Keep HEAD content for env files, then ensure_minio_env_files will re-apply correct MinIO values
        git checkout --ours -- .env .env.production 2>/dev/null || true
        git add -- .env .env.production 2>/dev/null || true
        # Clear any remaining unmerged paths for env files
        if git diff --name-only --diff-filter=U 2>/dev/null | grep -qE '^\.env'; then
          git checkout HEAD -- .env .env.production 2>/dev/null || true
          git add -- .env .env.production 2>/dev/null || true
        fi
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

ensure_alm_shared_network() {
  if [[ "$ENSURE_ALM_SHARED" != "1" ]]; then
    log "ENSURE_ALM_SHARED=0 — skipping shared Docker network setup"
    return
  fi
  log "Ensuring Docker network ${ALM_SHARED_NETWORK} and attaching ${POSTGRES_CONTAINER}..."
  docker network create "$ALM_SHARED_NETWORK" 2>/dev/null || true
  if docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1; then
    docker network connect "$ALM_SHARED_NETWORK" "$POSTGRES_CONTAINER" 2>/dev/null \
      || log "Note: ${POSTGRES_CONTAINER} likely already on ${ALM_SHARED_NETWORK} (OK)."
  else
    log "WARN: container ${POSTGRES_CONTAINER} not found — fix POSTGRES_CONTAINER or start Postgres first."
  fi
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
  log "Compose ($label): cd $dir && $cmd up -d --build"
  ( cd "$dir" && $cmd up -d --build )
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
    ensure_alm_shared_network
    compose_v1_remove_container_if_exists "$compose_cmd" "$BACKEND_CONTAINER_NAME"
    compose_up "$BACKEND_DIR" "backend"
    verify_container_health "$BACKEND_CONTAINER_NAME" "$BACKEND_HOST_PORT" "backend"
    ensure_minio_network "$BACKEND_CONTAINER_NAME"
    ensure_minio_bucket "$BACKEND_CONTAINER_NAME"
  fi

  if [[ "$BACKEND_ONLY" != "1" ]]; then
    [[ -d "$FRONTEND_DIR" ]] || die "Frontend directory missing: $FRONTEND_DIR"
    git_pull_with_stash "$FRONTEND_DIR" "frontend"
    compose_v1_remove_container_if_exists "$compose_cmd" "$FRONTEND_CONTAINER_NAME"
    compose_up "$FRONTEND_DIR" "frontend"
    verify_container_health "$FRONTEND_CONTAINER_NAME" "$FRONTEND_HOST_PORT" "frontend"
  fi

  log "Deploy complete. Public URL: ensure nginx proxies /api → 127.0.0.1:${BACKEND_HOST_PORT}"
}

main "$@"
