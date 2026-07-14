#!/usr/bin/env bash
#
# Docker deploy — TENANT backend (alm-tenant-backend, port 5001).
# Run on server from ~/tenant-ALM-Wildcard/backend
#
#   ./deploy-docker.sh           # stash, pull backend, rebuild
#   ./deploy-docker.sh --all     # backend + frontend (../frontend)
#   ./deploy-docker.sh --rebuild # rebuild only (no git pull)
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALM_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOY="${SCRIPT_DIR}/scripts/deploy/deploy-pull-rebuild.sh"

export ALM_ROOT
export BACKEND_DIR="${SCRIPT_DIR}"
export FRONTEND_DIR="${ALM_ROOT}/frontend"
export BACKEND_CONTAINER_NAME=alm-tenant-backend
export FRONTEND_CONTAINER_NAME=alm-tenant-web
export BACKEND_HOST_PORT=5001
export FRONTEND_HOST_PORT=3001
export MINIO_BUCKET_VALUE=alm-tenant
# Must match docker-compose ports "5001:5001" — never allow PORT=5000 from git .env
export ENSURE_BACKEND_PORT=5001
export ENSURE_REDIS_URL=redis://alm_redis:6379/0
# alm_db / pressana db_host IPs have no TLS — never force SSL on tenant pools
export ENSURE_DB_SSL=false

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
      echo "Tenant stack: alm-tenant-backend:5001, alm-tenant-web:3001"
      exit 0
      ;;
  esac
done

export BACKEND_ONLY="${BACKEND_ONLY:-1}"
export FRONTEND_ONLY="${FRONTEND_ONLY:-0}"
exec "$DEPLOY"
