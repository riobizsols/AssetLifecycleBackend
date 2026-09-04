# PostgreSQL connections (shared DB on rio-server)

## Current baseline
- `max_connections` = **100**
- `shared_buffers` = **128 MB** (Docker default)
- `work_mem` = **4 MB**

## How high can you go?
Rule of thumb (without PgBouncer):

| Container / host RAM for Postgres | Practical `max_connections` |
|-----------------------------------|-----------------------------|
| ~1 GB | 50–100 |
| ~2 GB | 100–150 |
| ~4 GB | **150–250** (recommended band) |
| ~8 GB+ | 250–300 |
| 400–500+ | Use **PgBouncer**; don’t raise raw max that high |

Rough memory: each connection ≈ **5–10 MB** base (+ `work_mem` when sorting).  
Example: **200 connections × ~8 MB ≈ 1.6 GB** just for sessions, plus `shared_buffers`.

**Recommended for this shared ALM + Attendance host: `200`.**  
Only go to `250–300` if `alm_db` has ≥4 GB RAM. Prefer **PgBouncer** over raising raw `max_connections` above ~300.

See **[docs/PGBOUNCER.md](../../docs/PGBOUNCER.md)** for ALM main stack rollout (`web.rioassetmanagement.net`).

## Increase max_connections
```bash
cd ~/…/AssetLifecycleBackend   # or local clone
chmod +x scripts/db/increase-max-connections.sh
./scripts/db/increase-max-connections.sh
# or: MAX_CONNECTIONS=250 ./scripts/db/increase-max-connections.sh
```

Then on **rio-server**:
```bash
docker restart alm_db
# verify
docker exec -it alm_db psql -U postgres -c 'SHOW max_connections;'
```

`ALTER SYSTEM` alone does **not** apply until restart (`pending_restart = t`).

## Weekly idle cleanup
Script: `scripts/db/clear-idle-connections.js`  
Kills **idle** client backends older than `IDLE_MINUTES` (default 15).

### Cron (weekly Sunday 03:15 server time)
On rio-server (or any host that can reach the DB):

```bash
# install once
cd /path/to/AssetLifecycleBackend
npm ci --omit=dev   # if needed for pg + dotenv

crontab -e
```

Add:
```cron
15 3 * * 0 cd /path/to/AssetLifecycleBackend && /usr/bin/node scripts/db/clear-idle-connections.js >> /var/log/pg-idle-cleanup.log 2>&1
```

Dry run:
```bash
DRY_RUN=1 IDLE_MINUTES=15 node scripts/db/clear-idle-connections.js
```

Only idle > 30 minutes:
```bash
IDLE_MINUTES=30 node scripts/db/clear-idle-connections.js
```
