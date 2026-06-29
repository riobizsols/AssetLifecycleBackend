# Scaling Guide — Single Server + Docker

**Your production setup:** One server, one PostgreSQL database, backend in **Docker** (`docker-compose.yml`), **not PM2**.

```
Users → nginx (host) → alm-main-backend container :5002→5000
                              ↓
                         alm_redis (Docker)
                              ↓
                         alm_db (Postgres, shared Docker network)
```

---

## What matters for 1000s of users (your stack)

On a **single Docker container + single DB**, scale comes from:

1. **Caching** (already built) — auth, lists, reports
2. **Redis in Docker** — you already have `alm-redis` in compose; must be wired in `.env.production`
3. **Sensible DB pool size** — one Node process, one pool
4. **nginx** on the host — gzip, rate limits, static frontend
5. **Pagination** — don’t load 1000+ rows per request

You do **not** need PM2 or multiple app servers for your current architecture.

---

## Docker deployment (what you use)

```bash
# On server (see deploy-docker.sh)
docker compose up -d --build
```

| Container | Role |
|-----------|------|
| `alm-main-backend` | `node server.js` (single process) |
| `alm_redis` | Shared cache for that backend |
| `alm_db` | Postgres (external container on `alm-shared` network) |

**Health checks after deploy:**

```bash
curl http://localhost:5002/health
curl http://localhost:5002/ready
```

---

## Required `.env.production` settings

```env
NODE_ENV=production
PORT=5000

# Main DB — use Docker network hostname (see docker-compose comments)
DATABASE_URL=postgresql://USER:PASS@alm_db:5432/hospitality
TENANT_DATABASE_URL=postgresql://USER:PASS@alm_db:5432/postgres

# Redis — service name from docker-compose.yml
CACHE_ENABLED=true
REDIS_URL=redis://alm_redis:6379/0

# Single container: one pool (not per-PM2-worker)
DB_POOL_MAX=20
DB_POOL_MIN=2
TENANT_REGISTRY_POOL_MAX=10
TENANT_DB_POOL_MAX=5

TRUST_PROXY=true
RATE_LIMIT_MAX_PER_MIN=300
AUTH_RATE_LIMIT_MAX_PER_15MIN=30
```

**Important:** If `REDIS_URL` is wrong or Redis is down, the app still runs (L1 memory cache inside the container), but you lose shared cache on restart and see `[Redis] Connection error` in logs.

---

## What’s already optimized (app layer)

| Layer | Feature |
|-------|---------|
| Auth | JWT + auth context cache |
| Tenant | Cached lookup + **reused tenant pools** (not per request) |
| APIs | `operationalCache` / `reportsCache` |
| Frontend | Zustand + `apiCache`, prefetch, revalidate-on-focus |
| Assets | Server pagination (50/page) |
| HTTP | compression, helmet, rate limits (`scalingMiddleware.js`) |

Benchmarks: cold ~50–120ms, warm ~3–7ms — see `API_PERFORMANCE_REPORT.md`.

---

## Realistic capacity (one server, one DB, one backend container)

| Concurrent active users | Typical experience |
|-------------------------|-------------------|
| **50–200** | Comfortable with Redis + caching |
| **200–500** | OK if most traffic hits cached list APIs |
| **500–1000+** | Possible but DB becomes the bottleneck; tune pools, cap report page sizes, add indexes |

“1000 users” usually means **1000 registered users**, not 1000 simultaneous API calls. With caching, **hundreds of concurrent requests** on one well-tuned Node container is realistic.

---

## If you need more later (without PM2)

Stay on Docker; options in order:

1. **Tune Postgres** — `max_connections`, indexes on report filters
2. **Cap report `limit`** — 100–200 instead of 1000
3. **Frontend code splitting** — smaller initial JS bundle
4. **Second backend container** + load balancer (same server, still one DB) — only if CPU is maxed
5. **Separate DB read replica** — only for heavy reports

`ecosystem.config.js` / PM2 are **optional** for local or legacy deploys — **not used** in your Docker path.

---

## Pre-go-live checklist (Docker)

- [ ] `alm_redis` running: `docker ps | grep alm_redis`
- [ ] `.env.production` has `REDIS_URL=redis://alm_redis:6379/0`
- [ ] `DATABASE_URL` / `TENANT_DATABASE_URL` use `alm_db` hostname on `alm-shared` network
- [ ] `curl localhost:5002/ready` returns `ready`
- [ ] nginx proxies to port **5002** (host mapping)
- [ ] `DB_POOL_MAX` ≤ ~25 on single container (leave room for Postgres admin tools)

---

*PM2 docs in `QUICK_DEPLOY.sh` are legacy; production uses `deploy-docker.sh` + `docker-compose.yml`.*
