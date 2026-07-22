#!/usr/bin/env bash
#
# Docker deploy — BACKEND container (alm-main-backend).
# Pushed with this repo; run on server from ~/alm-main/AssetLifecycleBackend
#
#   ./deploy-docker.sh           # stash, pull backend, rebuild
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
export MINIO_BUCKET_VALUE="${MINIO_BUCKET_VALUE:-alm-main}"
exec "$DEPLOY"
