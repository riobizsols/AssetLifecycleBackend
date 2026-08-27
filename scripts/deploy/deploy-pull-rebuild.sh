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
REDIS_CONTAINER="${REDIS_CONTAINER:-alm_redis}"
REDIS_COMPOSE_FILE="${REDIS_COMPOSE_FILE:-docker-compose.redis.yml}"
PGBOUNCER_CONTAINER="${PGBOUNCER_CONTAINER:-alm_pgbouncer}"
PGBOUNCER_COMPOSE_FILE="${PGBOUNCER_COMPOSE_FILE:-docker-compose.pgbouncer.yml}"
ENSURE_PGBOUNCER="${ENSURE_PGBOUNCER:-}"
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

# Compose v2 does not hit the 1.29 recreate bug, but fixed container_name values
# (alm-main-backend / alm-main-frontend) still conflict with containers left
# from an older compose project (e.g. assetlifecyclebackend). Always remove
# by exact name before force-recreate.
remove_named_container_if_exists() {
  local cname="$1"
  if docker inspect "$cname" >/dev/null 2>&1; then
    log "Removing existing container ${cname} before recreate..."
    docker rm -f "$cname" || true
  fi
}

repo_has_local_changes() {
  local dir="$1"
  [[ -n "$(cd "$dir" && git status --porcelain 2>/dev/null)" ]]
}

# .env / .env.production often conflict on stash pop. Reset them to HEAD so
# stash/pull can proceed; ensure_minio_env_files re-applies MinIO values later.
clear_env_merge_conflicts() {
  local label="${1:-repo}"
  local unmerged leftover
  unmerged="$(git diff --name-only --diff-filter=U 2>/dev/null || true)"
  if [[ -z "$unmerged" ]]; then
    return 0
  fi

  log "[$label] Unmerged paths detected — clearing env merge conflicts..."
  printf '%s\n' "$unmerged"

  # Backup whatever is on disk before resetting
  [[ -f .env ]] && cp -a .env ".env.bak.$(date -u +%Y%m%d%H%M%S)" 2>/dev/null || true
  [[ -f .env.production ]] && cp -a .env.production ".env.production.bak.$(date -u +%Y%m%d%H%M%S)" 2>/dev/null || true

  # Prefer keeping on-disk server env; only use HEAD if file missing
  if [[ ! -f .env.production ]]; then
    git checkout HEAD -- .env.production 2>/dev/null || true
  fi
  if [[ ! -f .env ]]; then
    git checkout HEAD -- .env 2>/dev/null || true
  fi
  # Clear conflict state in index without overwriting restored files if present
  git add -u -- .env .env.production 2>/dev/null || true
  git reset HEAD -- .env .env.production 2>/dev/null || true

  # If still unmerged (file only existed on one side), reset the index entry
  if git diff --name-only --diff-filter=U 2>/dev/null | grep -qE '^\.env'; then
    git reset HEAD -- .env .env.production 2>/dev/null || true
    git checkout --ours -- .env .env.production 2>/dev/null || true
    git add -- .env .env.production 2>/dev/null || true
  fi

  if git diff --name-only --diff-filter=U 2>/dev/null | grep -qE '^\.env'; then
    die "[$label] Could not clear .env merge conflicts. Restore from .env.production.bak.* then: git reset HEAD -- .env .env.production"
  fi

  log "[$label] Env merge conflicts cleared (backups: .env.bak.* if present)"

  # Stash pop can also conflict on code (e.g. docker-compose.pgbouncer.yml).
  # Take the just-pulled HEAD for those paths so deploy is not stuck mid-merge.
  leftover="$(git diff --name-only --diff-filter=U 2>/dev/null || true)"
  if [[ -n "$leftover" ]]; then
    log "[$label] Taking HEAD for remaining unmerged files (local/stash copies discarded for those paths):"
    printf '%s\n' "$leftover"
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      git checkout HEAD -- "$f" 2>/dev/null || true
      git add -- "$f" 2>/dev/null || true
    done <<< "$leftover"
  fi

  leftover="$(git diff --name-only --diff-filter=U 2>/dev/null || true)"
  if [[ -n "$leftover" ]]; then
    die "[$label] Still unmerged. On the server run:
  git checkout HEAD -- $leftover
  git add $leftover"
  fi
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
      if ! git stash push -u -m "${STASH_MESSAGE_PREFIX} $(date -u +%Y-%m-%dT%H:%M:%SZ)" -- . ':(exclude).env' ':(exclude).env.production' ':(exclude).env.*'; then
        log "[$label] WARN: pathspec stash failed — trying full stash after resetting env files"
        clear_env_merge_conflicts "$label"
        # Do NOT checkout HEAD for env here — preserve_env already backed them up;
        # restore after this failed-path stash as well.
        git stash push -u -m "${STASH_MESSAGE_PREFIX} $(date -u +%Y-%m-%dT%H:%M:%SZ)" -- . ':(exclude).env' ':(exclude).env.production'
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
        log "[$label] WARN: stash pop had conflicts — auto-resolving without wiping restored .env*"
        # Backup current (restored) env again before conflict cleaner touches them
        local conflict_bak=".env-conflict-bak.$(date -u +%Y%m%d%H%M%S)"
        mkdir -p "$conflict_bak"
        [[ -f .env ]] && cp -a .env "$conflict_bak/.env"
        [[ -f .env.production ]] && cp -a .env.production "$conflict_bak/.env.production"
        clear_env_merge_conflicts "$label"
        [[ -f "$conflict_bak/.env" ]] && cp -a "$conflict_bak/.env" .env
        [[ -f "$conflict_bak/.env.production" ]] && cp -a "$conflict_bak/.env.production" .env.production
        rm -rf "$conflict_bak"
        log "[$label] Env restored after conflict resolve (MinIO settings will be re-applied next)"
        if git stash list | head -1 | grep -q "$STASH_MESSAGE_PREFIX"; then
          log "[$label] Dropping leftover auto-stash after conflict resolve"
          git stash drop || true
        else
          log "[$label] Remaining stash (if any): git stash list"
        fi
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

# Shared Redis (alm_redis) is managed separately from backend deploy to avoid
# container name conflicts when an older compose project already created it.
ensure_redis() {
  if ! docker inspect "$REDIS_CONTAINER" >/dev/null 2>&1; then
    if [[ ! -f "${BACKEND_DIR}/${REDIS_COMPOSE_FILE}" ]]; then
      log "WARN: Redis ${REDIS_CONTAINER} not found and ${REDIS_COMPOSE_FILE} missing — start it from the main ALM stack (shared alm_redis)."
      return
    fi
    log "Redis container ${REDIS_CONTAINER} not found — creating from ${REDIS_COMPOSE_FILE}..."
    ensure_alm_shared_network
    local cmd
    cmd="$(detect_compose)"
    ( cd "$BACKEND_DIR" && $cmd -f "$REDIS_COMPOSE_FILE" up -d )
  elif ! container_is_running "$REDIS_CONTAINER"; then
    log "Starting stopped Redis container ${REDIS_CONTAINER}..."
    docker start "$REDIS_CONTAINER"
  else
    log "Redis ${REDIS_CONTAINER} already running — reusing existing container"
  fi

  docker network connect "$ALM_SHARED_NETWORK" "$REDIS_CONTAINER" 2>/dev/null \
    || log "Note: ${REDIS_CONTAINER} likely already on ${ALM_SHARED_NETWORK} (OK)."
}

run_node() {
  if command -v node >/dev/null 2>&1; then
    ( cd "$BACKEND_DIR" && node "$@" )
    return
  fi
  log "Host has no node — running via docker node:20-bookworm-slim"
  docker run --rm \
    -v "$BACKEND_DIR":/app \
    -w /app \
    node:20-bookworm-slim \
    node "$@"
}

ensure_pgbouncer() {
  if [[ "$ENSURE_PGBOUNCER" != "1" ]]; then
    log "ENSURE_PGBOUNCER=0 — skipping PgBouncer setup"
    return
  fi

  ensure_alm_shared_network
  log "Rendering PgBouncer config from .env.production..."
  run_node scripts/db/render-pgbouncer-config.js

  local cmd
  cmd="$(detect_compose)"

  if ! docker inspect "$PGBOUNCER_CONTAINER" >/dev/null 2>&1; then
    log "PgBouncer container ${PGBOUNCER_CONTAINER} not found — creating from ${PGBOUNCER_COMPOSE_FILE}..."
    ( cd "$BACKEND_DIR" && $cmd -f "$PGBOUNCER_COMPOSE_FILE" up -d )
  elif ! container_is_running "$PGBOUNCER_CONTAINER"; then
    log "Starting stopped PgBouncer container ${PGBOUNCER_CONTAINER}..."
    docker start "$PGBOUNCER_CONTAINER"
  else
    log "PgBouncer ${PGBOUNCER_CONTAINER} already running — applying config refresh"
    ( cd "$BACKEND_DIR" && $cmd -f "$PGBOUNCER_COMPOSE_FILE" up -d )
  fi

  docker network connect "$ALM_SHARED_NETWORK" "$PGBOUNCER_CONTAINER" 2>/dev/null \
    || log "Note: ${PGBOUNCER_CONTAINER} likely already on ${ALM_SHARED_NETWORK} (OK)."
}

# Return 0 if key is missing or has an empty value in file (after stripping quotes).
env_key_is_empty() {
  local file="$1"
  local key="$2"
  local line val
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 || true)"
  if [[ -z "$line" ]]; then
    return 0
  fi
  val="${line#*=}"
  if [[ "$val" == \"*\" ]]; then
    val="${val:1:${#val}-2}"
  elif [[ "$val" == \'*\' ]]; then
    val="${val:1:${#val}-2}"
  fi
  [[ -z "$val" ]]
}

# Permanent fix: .env.production is what Docker uses — fill any missing/empty keys
# from .env (server secrets often live only in .env after manual nano edits).
# Dies if required keys are still missing after sync.
ensure_compose_env_complete() {
  local dir="${1:-$BACKEND_DIR}"
  local src="${dir}/.env"
  local dst="${dir}/.env.production"
  local example="${dir}/.env.production.example"
  local filled=0
  local line key
  local -a missing=()

  # Compose lists both files — ensure .env exists so `docker compose` does not fail
  if [[ ! -f "$src" ]]; then
    touch "$src"
    log "[env] Created empty .env (compose env_file requires the path)"
  fi

  if [[ ! -f "$dst" ]]; then
    if [[ -f "$src" ]] && grep -qE '^[A-Za-z_][A-Za-z0-9_]*=' "$src" 2>/dev/null; then
      cp -a "$src" "$dst"
      log "[env] Created .env.production from .env"
    elif [[ -f "$example" ]]; then
      cp -a "$example" "$dst"
      log "[env] Created .env.production from .env.production.example — fill real secrets"
    else
      die "[env] Missing .env.production (and no .env / example to copy)"
    fi
  fi

  if [[ -f "$src" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ "$line" =~ ^[[:space:]]*$ ]] && continue
      [[ "$line" != *=* ]] && continue
      key="${line%%=*}"
      [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
      if env_key_is_empty "$dst" "$key"; then
        # Drop empty/placeholder KEY= lines, then append the full source line
        if grep -qE "^${key}=" "$dst" 2>/dev/null; then
          sed -i.bak "/^${key}=/d" "$dst" && rm -f "${dst}.bak"
        fi
        printf '%s\n' "$line" >> "$dst"
        filled=$((filled + 1))
        log "[env] Filled ${key} into .env.production from .env"
      fi
    done < "$src"
    if [[ "$filled" -gt 0 ]]; then
      log "[env] Synced ${filled} missing/empty key(s) .env → .env.production"
    else
      log "[env] .env.production already has all keys present in .env"
    fi
  fi

  # Strip empty FIREBASE_/DATABASE_ placeholders so earlier .env can win in compose
  # (compose: later file wins — empty .env.production must not blank out .env)
  local empty_stripped=0
  local ek
  for ek in \
    DATABASE_URL TENANT_DATABASE_URL GENERIC_URL JWT_SECRET \
    FIREBASE_PROJECT_ID FIREBASE_PRIVATE_KEY_ID FIREBASE_PRIVATE_KEY \
    FIREBASE_CLIENT_EMAIL FIREBASE_CLIENT_ID \
    ZOHO_CLIENT_ID ZOHO_CLIENT_SECRET EMAIL_USER EMAIL_PASS \
    ACCESS_REQUEST_OPS_PASSWORD
  do
    if grep -qE "^${ek}=" "$dst" 2>/dev/null && env_key_is_empty "$dst" "$ek"; then
      sed -i.bak "/^${ek}=/d" "$dst" && rm -f "${dst}.bak"
      empty_stripped=$((empty_stripped + 1))
      log "[env] Removed empty ${ek}= from .env.production (so .env can supply it)"
    fi
  done
  [[ "$empty_stripped" -gt 0 ]] && log "[env] Stripped ${empty_stripped} empty override(s) from .env.production"

  for key in DATABASE_URL JWT_SECRET; do
    if env_key_is_empty "$dst" "$key" && env_key_is_empty "$src" "$key"; then
      missing+=("$key")
    fi
  done
  if [[ "${BACKEND_CONTAINER_NAME:-}" == "alm-tenant-backend" ]]; then
    if env_key_is_empty "$dst" "TENANT_DATABASE_URL" && env_key_is_empty "$src" "TENANT_DATABASE_URL"; then
      missing+=("TENANT_DATABASE_URL")
    fi
  fi
  if [[ ${#missing[@]} -gt 0 ]]; then
    die "[env] Required keys missing in both .env and .env.production: ${missing[*]}"
  fi

  for key in FIREBASE_PROJECT_ID FIREBASE_PRIVATE_KEY FIREBASE_CLIENT_EMAIL; do
    if env_key_is_empty "$dst" "$key" && env_key_is_empty "$src" "$key"; then
      log "WARN: [env] ${key} unset — FCM push notifications will be disabled"
    fi
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
    # Tenant deploy: pin PORT/Redis/SSL so main .env values never override stack (5001 / alm_db no TLS)
    if [[ -n "${ENSURE_BACKEND_PORT:-}" ]]; then
      upsert_minio_kv "$f" "PORT" "$ENSURE_BACKEND_PORT"
      log "Ensured PORT=${ENSURE_BACKEND_PORT} in $(basename "$f")"
    fi
    if [[ -n "${ENSURE_REDIS_URL:-}" ]]; then
      upsert_minio_kv "$f" "REDIS_URL" "$ENSURE_REDIS_URL"
    fi
    if [[ -n "${ENSURE_DB_SSL:-}" ]]; then
      upsert_minio_kv "$f" "DB_SSL" "$ENSURE_DB_SSL"
      log "Ensured DB_SSL=${ENSURE_DB_SSL} in $(basename "$f")"
    fi
    if [[ -n "${ENSURE_DATABASE_SSL:-}" ]]; then
      upsert_minio_kv "$f" "DATABASE_SSL" "$ENSURE_DATABASE_SSL"
      log "Ensured DATABASE_SSL=${ENSURE_DATABASE_SSL} in $(basename "$f")"
    fi
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
  local service="${3:-}"
  local cmd
  cmd="$(detect_compose)"
  if [[ -n "$service" ]]; then
    log "Compose ($label): cd $dir && $cmd up -d --build --force-recreate $service"
    ( cd "$dir" && $cmd up -d --build --force-recreate "$service" )
  else
    log "Compose ($label): cd $dir && $cmd up -d --build"
    ( cd "$dir" && $cmd up -d --build )
  fi
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

  # Main stack owns alm_pgbouncer. Tenant (and any non-main backend) defaults off.
  if [[ "$BACKEND_CONTAINER_NAME" == "alm-main-backend" ]]; then
    if [[ "$FRONTEND_ONLY" != "1" ]]; then
      ENSURE_PGBOUNCER="${ENSURE_PGBOUNCER:-1}"
    else
      ENSURE_PGBOUNCER="${ENSURE_PGBOUNCER:-0}"
    fi
  else
    ENSURE_PGBOUNCER="${ENSURE_PGBOUNCER:-0}"
  fi


  if [[ "$FRONTEND_ONLY" != "1" ]]; then
    [[ -d "$BACKEND_DIR" ]] || die "Backend directory missing: $BACKEND_DIR"
    git_pull_with_stash "$BACKEND_DIR" "backend"
    ensure_compose_env_complete "$BACKEND_DIR"
    ensure_minio_env_files "$BACKEND_DIR"
    ensure_alm_shared_network
    ensure_redis
    ensure_pgbouncer
    compose_v1_remove_container_if_exists "$compose_cmd" "$BACKEND_CONTAINER_NAME"
    remove_named_container_if_exists "$BACKEND_CONTAINER_NAME"
    compose_up "$BACKEND_DIR" "backend" "alm-backend"
    verify_container_health "$BACKEND_CONTAINER_NAME" "$BACKEND_HOST_PORT" "backend"
    ensure_minio_network "$BACKEND_CONTAINER_NAME"
    ensure_minio_bucket "$BACKEND_CONTAINER_NAME"
  fi

  if [[ "$BACKEND_ONLY" != "1" ]]; then
    [[ -d "$FRONTEND_DIR" ]] || die "Frontend directory missing: $FRONTEND_DIR"
    git_pull_with_stash "$FRONTEND_DIR" "frontend"
    compose_v1_remove_container_if_exists "$compose_cmd" "$FRONTEND_CONTAINER_NAME"
    remove_named_container_if_exists "$FRONTEND_CONTAINER_NAME"
    compose_up "$FRONTEND_DIR" "frontend" "alm-frontend"
    verify_container_health "$FRONTEND_CONTAINER_NAME" "$FRONTEND_HOST_PORT" "frontend"
  fi

  log "Deploy complete. Public URL: ensure nginx proxies /api → 127.0.0.1:${BACKEND_HOST_PORT}"
}

main "$@"
