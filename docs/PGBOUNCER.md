# PgBouncer — ALM main stack (web.rioassetmanagement.net)

PgBouncer sits between **alm-main-backend** and **alm_db** on the internal Docker network `alm-shared`.  
The **frontend does not connect to Postgres** — no frontend changes are required.

## Architecture

```
Browser → nginx → alm-main-frontend (static)
              → alm-main-backend (Node/pg pools)
                    → alm_pgbouncer:6432  (transaction pooling)
                          → alm_db:5432   (Postgres)

Tenant setup / CREATE DATABASE → alm_db:5432 direct (bypass PgBouncer)
```

## Rollout on rio-server (main stack only)

```bash
cd ~/alm-main/AssetLifecycleBackend
git pull

# 1) Start PgBouncer container (deploy script does this for alm-main-backend)
node scripts/db/render-pgbouncer-config.js
docker compose -f docker-compose.pgbouncer.yml up -d

# 2) Point app env at PgBouncer (backs up POSTGRES_DIRECT_URL)
chmod +x scripts/db/enable-pgbouncer-main.sh
./scripts/db/enable-pgbouncer-main.sh

# 3) Update tenant registry rows if any tenant DBs use alm_db host
node scripts/db/migrate-tenants-to-pgbouncer.js

# 4) Verify + redeploy backend
node scripts/db/verify-pgbouncer.js
./deploy-docker.sh --rebuild
```

Or use full deploy (starts PgBouncer automatically for `alm-main-backend`):

```bash
./deploy-docker.sh
# then run enable-pgbouncer-main.sh once before restart if not done yet
```

## Env vars (`.env.production`)

| Variable | Purpose |
|---|---|
| `PGBOUNCER_ENABLED=true` | App uses PgBouncer host for runtime pools |
| `PGBOUNCER_HOST=alm_pgbouncer` | Docker DNS name |
| `PGBOUNCER_PORT=6432` | PgBouncer listen port |
| `POSTGRES_DIRECT_URL` | Direct Postgres for DDL/admin (never via PgBouncer) |
| `DATABASE_URL` | App pool → should use `alm_pgbouncer:6432` when enabled |
| `TENANT_DATABASE_URL` | Tenant registry → `alm_pgbouncer:6432/postgres` when enabled |

## Pool sizing

After PgBouncer, reduce Node pool sizes (see `.env.production.example`):

- `DB_POOL_MAX=10`
- `TENANT_DB_POOL_MAX=3`

PgBouncer settings (render script / env):

- `PGBOUNCER_POOL_MODE=transaction` (matches app `BEGIN`/`COMMIT` usage)
- `PGBOUNCER_DEFAULT_POOL_SIZE=25`

## What must bypass PgBouncer

- `CREATE DATABASE` / `ALTER DATABASE`
- Tenant onboarding (`tenantSetupService.js`) — uses `getPostgresDirectClientOpts()`
- Connection cleanup scripts (`clear-idle-connections.js`, `manage-db-connections.js`)

## Tenant stack (later)

Repeat the same pattern for `alm-tenant-backend` with:

```bash
ENSURE_PGBOUNCER=1 BACKEND_CONTAINER_NAME=alm-tenant-backend ./deploy-docker.sh
```

Use a separate PgBouncer instance or shared `alm_pgbouncer` (current design: **one shared** `alm_pgbouncer` for all DB names on `alm_db`).

## Troubleshooting

```bash
docker logs alm_pgbouncer --tail 50
docker exec -it alm-main-backend node scripts/db/verify-pgbouncer.js
docker network inspect alm-shared --format '{{range .Containers}}{{.Name}} {{end}}'
```

Expected on `alm-shared`: `alm_db`, `alm_redis`, `alm_pgbouncer`, `alm-main-backend`.

## Disable / rollback

1. Set `DATABASE_URL` / `TENANT_DATABASE_URL` back to `alm_db:5432`
2. Set `PGBOUNCER_ENABLED=false`
3. `node scripts/db/migrate-tenants-to-pgbouncer.js` with manual SQL to revert hosts, or update `tenants.db_host` to `alm_db`
4. Restart `alm-main-backend`
