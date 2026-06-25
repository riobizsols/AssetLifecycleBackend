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
        log "[$label] WARN: stash pop had conflicts. Your changes are in: git stash list"
        log "[$label] Fix conflicts manually, then: cd $dir && git status"
        exit 1
      fi
      log "[$label] Local changes restored after pull"
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
    ensure_alm_shared_network
    compose_v1_remove_container_if_exists "$compose_cmd" "$BACKEND_CONTAINER_NAME"
    compose_up "$BACKEND_DIR" "backend"
    verify_container_health "$BACKEND_CONTAINER_NAME" "$BACKEND_HOST_PORT" "backend"
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
