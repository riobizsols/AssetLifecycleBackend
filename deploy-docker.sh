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
exec "$DEPLOY"
