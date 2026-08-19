#!/usr/bin/env bash
#
# Docker deploy — Pressana BACKEND (alm-pressana-backend :5003).
# Run on server from ~/pressana-ALM/AssetLifecycleBackend (or this repo path).
#
#   ./deploy-docker.sh           # backend only
#   ./deploy-docker.sh --all     # backend + frontend
#   ./deploy-docker.sh --rebuild # rebuild only (no git pull)
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="${SCRIPT_DIR}/scripts/deploy/deploy-pull-rebuild.sh"

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
export BACKEND_CONTAINER_NAME="${BACKEND_CONTAINER_NAME:-alm-pressana-backend}"
export FRONTEND_CONTAINER_NAME="${FRONTEND_CONTAINER_NAME:-alm-pressana-frontend}"
export BACKEND_HOST_PORT="${BACKEND_HOST_PORT:-5003}"
export FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-3003}"
export MINIO_BUCKET_VALUE="${MINIO_BUCKET_VALUE:-alm-pressana}"
export PRESSANA_DB_NAME="${PRESSANA_DB_NAME:-demopressana_db}"
export PRESSANA_PUBLIC_URL="${PRESSANA_PUBLIC_URL:-https://pressanaorg.rioassetmanagement.net}"
export PRESSANA_APP_PORT="${PRESSANA_APP_PORT:-5001}"
export PRESSANA_REDIS_URL="${PRESSANA_REDIS_URL:-redis://alm_redis:6379/0}"
export PRESSANA_RESERVED_SUBDOMAINS="${PRESSANA_RESERVED_SUBDOMAINS:-web,www,api,pressanaorg}"
export FORCE_COMPOSE_RECREATE="${FORCE_COMPOSE_RECREATE:-1}"
export SKIP_FRONTEND_IF_UNCHANGED="${SKIP_FRONTEND_IF_UNCHANGED:-1}"
export COMPOSE_IGNORE_ORPHANS="${COMPOSE_IGNORE_ORPHANS:-1}"
# Prevent clobbering ~/alm-main compose project (same folder name AssetLifecycleBackend)
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-pressana-alm}"
exec "$DEPLOY"
