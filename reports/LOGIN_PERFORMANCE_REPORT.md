# Login Performance Test Report

**Date:** 2026-06-11  
**Endpoint:** `POST /api/auth/login`  
**Target:** 100 concurrent users, 0% failure rate, acceptable response time  
**Environment:** Local Node backend → remote PostgreSQL (`103.192.199.178`, database `assetLifecycle`)

---

## Executive summary

| Metric | Before fixes | After fixes (100 users) | After fixes (200 requests, warm pool) |
|--------|--------------|-------------------------|---------------------------------------|
| Success rate | **55%** (45 × HTTP 500) | **100%** | **100%** |
| Throughput | 12.9 req/s | 16.0 req/s | 30.6 req/s |
| Avg latency | 3,706 ms | 4,543 ms | **2,197 ms** |
| p50 latency | 4,482 ms | 4,902 ms | **2,143 ms** |
| p95 latency | 7,444 ms | 6,153 ms | **3,679 ms** |
| p99 latency | 7,708 ms | 6,218 ms | **3,825 ms** |

**Result: PASS** — 100 concurrent logins complete without failure after fixes.

Cold-start first batch is slower (~5 s p50) due to pool warm-up and bcrypt CPU under load. With a warm connection pool, p50 drops to **~2.1 s** and p95 to **~3.7 s**.

---

## Root cause of failures (before fixes)

### 1. New PostgreSQL pool per login (critical)

`authController.js` created a **new `pg.Pool` (max 2 connections) on every login** and called `pool.end()` in `finally`.

With 100 simultaneous logins this attempted **~200 DB connections** in seconds.

**Postgres error:**
```
sorry, too many clients already
```

This caused **45% of requests to return HTTP 500**.

### 2. Duplicate pool in `findUserByEmail`

`userModel.js` created **another** short-lived pool when no tenant pool was passed, doubling connection churn.

### 3. Up to 3 sequential DB lookups per login

`findUserByEmail` always queried `tblRioAdmin` twice before `tblUsers`, adding unnecessary round-trips for normal users.

### 4. Auth event logging hammered DB (development)

Each login fired ~8 async auth log events. In development, each event called `TechnicalLogConfigModel.shouldLog()` → **DB query per event**. Under 100 concurrent logins this added hundreds of extra queries.

### 5. Misconfigured `DATABASE_URL`

`.env` had `DATABASE_URL` ending with `/` (no database name), causing logins to hit the wrong database (`tblUsers` / `tblRioAdmin` not found → HTTP 500).

**Fixed:** `DATABASE_URL` now points to `.../assetLifecycle` (same as `GENERIC_URL`).

---

## Fixes applied

| File | Change |
|------|--------|
| `controllers/authController.js` | Reuse shared app pool; remove per-request `Pool` create/destroy |
| `controllers/authController.js` | Parallelize post-auth queries (`getInitialPassword`, `last_accessed`, `getUserRoles`, branch info) |
| `controllers/authController.js` | Replace second `bcrypt.compare` with plaintext check after successful password match |
| `models/userModel.js` | Query `tblUsers` first; single RioAdmin fallback; no per-request pool |
| `models/technicalLogConfigModel.js` | 60 s in-memory cache for log config lookups |
| `models/userJobRoleModel.js` | Remove hot-path `console.log` |
| `.env` | `DATABASE_URL` includes `assetLifecycle` database name |

---

## Remaining latency factors (not bugs)

These explain why login is ~2–4 s under load even after fixes:

1. **Remote database** — Each login still runs ~5–6 queries over the network to `103.192.199.178`.
2. **bcrypt** — Password verification is intentionally CPU-heavy (~100 ms per compare at cost factor 10).
3. **Connection pool queueing** — `DB_POOL_MAX=10–30` means requests wait when all connections are busy.
4. **JWT + response assembly** — Minor compared to DB + bcrypt.

---

## Recommendations for production

### Must do (already done in code)

- [x] Never create per-request database pools in login
- [x] Use shared pool with sensible `DB_POOL_MAX`
- [x] Fix `DATABASE_URL` to include the correct database name

### Should do for faster login

1. **Increase `DB_POOL_MAX`** on the app server (e.g. 30–50) while staying under Postgres `max_connections`.
2. **Add DB indexes** (if missing):
   ```sql
   CREATE INDEX IF NOT EXISTS idx_users_email ON "tblUsers" (email);
   CREATE INDEX IF NOT EXISTS idx_rio_admin_email ON "tblRioAdmin" (email);
   ```
3. **Deploy backend near the database** — Co-locating app + DB typically cuts latency from seconds to hundreds of ms.
4. **Consider `bcrypt` rounds** — If currently 10+, evaluate 8 for faster auth (security trade-off; only with security review).
5. **Optional: login-specific slim endpoint** — Return token + minimal user info first; load roles/navigation in a second parallel call after redirect.

### Load test tooling (added to repo)

```bash
# 1. Seed 100 test users
node scripts/seed-load-test-users.js --count 100

# 2. Run load test (100 concurrent)
LOAD_TEST_BASE_URL=http://localhost:4000 \
LOAD_TEST_PASSWORD='LoadTest1!' \
node scripts/load-test-login.js --concurrency 100 --iterations 1

# 3. Cleanup test users
node scripts/seed-load-test-users.js --cleanup
```

Reports are saved under `reports/login-load-test-*.json`.

---

## Test data

- **Users:** `loadtest001@loadtest.local` … `loadtest100@loadtest.local`
- **Password:** `LoadTest1!` (load-test only; run `--cleanup` when finished)
- **JSON reports:**
  - Baseline (failed): `reports/login-load-test-1781175696169.json`
  - Optimized 100/100: `reports/login-load-test-1781175915795.json`
  - Optimized 200/200 warm: `reports/login-load-test-1781175931143.json`

---

## Conclusion

The login endpoint **failed under 100 concurrent users** due to connection exhaustion from per-request database pools. After fixing pool usage, query order, parallel post-auth fetches, and log-config caching:

- **100% success** at 100 concurrent logins
- **200/200 success** in a double batch with warm pool
- p50 latency **~2.1 s** (warm), p95 **~3.7 s**

For sub-second login at scale, co-locate the API with PostgreSQL and/or add a slim login response path.
