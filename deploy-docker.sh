#!/usr/bin/env bash
#
# Docker deploy — Bannari BACKEND (alm-bannari-backend :5004).
# Run on the server from the Bannari backend directory.
#
#   ./deploy-docker.sh           # backend only
#   ./deploy-docker.sh --all     # backend + frontend
#   ./deploy-docker.sh --rebuild # rebuild only (no git pull)
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALM_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY="${SCRIPT_DIR}/scripts/deploy/deploy-pull-rebuild.sh"

export ALM_ROOT
export BACKEND_DIR="${SCRIPT_DIR}"
export FRONTEND_DIR="${ALM_ROOT}/Frontend"

for arg in "$@"; do
  case "$arg" in
    --all)
      export BACKEND_ONLY=0
      export FRONTEND_ONLY=0
      ;;
    --rebuild)
      export SKIP_GIT_PULL=1
      export SKIP_FRONTEND_IF_UNCHANGED=0
      export FRONTEND_FORCE_RECREATE=1
      ;;
    --help|-h)
      echo "Usage: ./deploy-docker.sh [--all] [--rebuild]"
      exit 0
      ;;
  esac
done

export BACKEND_ONLY="${BACKEND_ONLY:-1}"
export FRONTEND_ONLY="${FRONTEND_ONLY:-0}"
export BACKEND_CONTAINER_NAME="${BACKEND_CONTAINER_NAME:-alm-bannari-backend}"
export FRONTEND_CONTAINER_NAME="${FRONTEND_CONTAINER_NAME:-alm-bannari-frontend}"
export BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-5004}"
export FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-3004}"
export MINIO_BUCKET_VALUE="${MINIO_BUCKET_VALUE:-alm-bannari}"
export BANNARI_DB_NAME="${BANNARI_DB_NAME:-bannari_db}"
export BANNARI_PUBLIC_URL="${BANNARI_PUBLIC_URL:-https://bannari.rioassetmanagement.net}"
export BANNARI_APP_PORT="${BANNARI_APP_PORT:-5001}"
export BANNARI_REDIS_URL="${BANNARI_REDIS_URL:-redis://alm_redis:6379/0}"
export BANNARI_RESERVED_SUBDOMAINS="${BANNARI_RESERVED_SUBDOMAINS:-web,www,api,pressanaorg,bannari}"
export FORCE_COMPOSE_RECREATE="${FORCE_COMPOSE_RECREATE:-1}"
export SKIP_FRONTEND_IF_UNCHANGED="${SKIP_FRONTEND_IF_UNCHANGED:-1}"
export COMPOSE_IGNORE_ORPHANS="${COMPOSE_IGNORE_ORPHANS:-1}"
# Prevent clobbering other ALM compose projects (same folder name AssetLifecycleBackend)
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-bannari-alm}"
exec "$DEPLOY"
