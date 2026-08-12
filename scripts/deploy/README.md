# Docker deploy scripts (server)

These files are **in the backend git repo** so they deploy with `git pull`.

## Server layout

```
~/alm-main/
  AssetLifecycleBackend/    ← git repo (scripts live here)
  AssetLifecycleWebFrontend/  ← git repo (thin wrapper)
```

## Commands

**Backend only** (from backend repo):

```bash
cd ~/alm-main/AssetLifecycleBackend
chmod +x deploy-docker.sh scripts/deploy/*.sh
./deploy-docker.sh
```

**Frontend only** (from frontend repo):

```bash
cd ~/alm-main/AssetLifecycleWebFrontend
chmod +x deploy-docker.sh
./deploy-docker.sh
```

**Both containers**:

```bash
cd ~/alm-main/AssetLifecycleBackend
./deploy-docker.sh --all
```

**Rebuild only** (after editing `.env.production`, no git pull):

```bash
./deploy-docker.sh --rebuild
# or frontend: cd ../AssetLifecycleWebFrontend && ./deploy-docker.sh --rebuild
```

## What each script does

1. Stash local changes (if any) — keeps `.env.production` safe
2. `git pull`
3. `stash pop`
4. Ensure shared network `alm-shared` and reuse/create `alm_redis` (Redis is **not** recreated on every backend deploy)
5. Remove old backend/frontend containers by name (Compose v1 + v2 safe)
6. `docker compose up -d --build --force-recreate` for the target service only
7. HTTP health check

## Redis (one-time per server)

Redis runs as a **shared** container `alm_redis` on network `alm-shared`. Backend connects via `REDIS_URL=redis://alm_redis:6379/0`.

If `alm_redis` is missing:

```bash
cd ~/alm-main/AssetLifecycleBackend
docker network create alm-shared 2>/dev/null || true
docker compose -f docker-compose.redis.yml up -d
```

## Env overrides

```bash
SKIP_GIT_PULL=1 ./deploy-docker.sh --rebuild
GIT_STASH=0 ./deploy-docker.sh
ALM_ROOT=/root/alm-main ./deploy-docker.sh --all
```
