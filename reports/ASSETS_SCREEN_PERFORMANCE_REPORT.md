# Assets Screen Performance Report

**Date:** 2026-06-15  
**Scenario:** Web `/assets` screen — 4 parallel API calls per page load  
**Database:** `hospitality` (~115 assets) on remote PostgreSQL  
**Backend:** Local Node → remote DB  

---

## What was wrong

The Assets screen felt slow under load because of how the list API worked:

| Issue | Impact |
|-------|--------|
| **No pagination** | `GET /api/assets` returned all ~115 assets every time (~80 KB JSON) |
| **Heavy SQL per request** | Full-table query with 3 JOINs on every screen open |
| **Extra DB round-trip** | `getUserWithBranch()` ran again in the controller even though auth middleware already loaded branch/org |
| **Blocking event logging** | `await logAssetsRetrieved()` on every list request |
| **Remote DB + pool queueing** | Under 50–100 concurrent users, connection pool wait dominated latency across all 4 APIs |

The page was **stable** (0% failures) but **slow** (~8 s at 50 users, ~15 s at 100 users).

---

## What we implemented

### Backend (`assetController.js`, `assetModel.js`)

- **Server-side pagination:** `GET /api/assets?page=1&limit=50` returns `{ rows, pagination }`
- **Backward compatible:** `GET /api/assets` (no params) still returns full array for modals/reports
- **`all=true`:** explicit full list when needed (e.g. when filters are active on the frontend)
- **Removed redundant `getUserWithBranch()`** — uses `req.user.org_id`, `req.user.branch_id`, `req.user.hasSuperAccess`
- **Parallel count + data queries** for paginated requests
- **Non-blocking logging** — event log no longer blocks the HTTP response

### Frontend (`Assets.jsx`)

- Initial load uses **page 1, 50 rows** (matches typical table UX)
- **Pagination controls** when more than one page
- When column/date filters are applied → fetches `all=true` so client-side filters still work on full data

### Load test (`load-test-assets-screen.js`)

- Uses `/api/assets?page=1&limit=50` to match the real screen

---

## Performance results

### Single user (warm, 5 runs)

| Endpoint | Response size | p50 latency |
|----------|---------------|-------------|
| `/api/assets?page=1&limit=50` | **35 KB** | **~1.4 s** |
| `/api/assets` (full list, before) | **80 KB** | **~1.5 s** |

~**56% smaller payload**, modest latency gain for one user on a remote DB.

### Concurrent screen loads (after optimization)

| Users | Success | Screen p50 | `/api/assets` p50 | Payload |
|-------|---------|------------|-------------------|---------|
| 50 | 100% | ~8.1 s | ~7.5 s | 35 KB |
| 100 × 2 | 100% | ~15.6 s | ~14.9 s | 35 KB |

### Before vs after (same test setup)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| `/api/assets` payload | ~80 KB | ~35 KB | **−56%** |
| `/api/assets` p50 @ 50 users | ~7.7 s | ~7.5 s | ~3% faster |
| `/api/assets` p50 @ 100 users | ~14.5 s | ~14.9 s | Similar (pool-bound) |
| Extra DB call per assets request | Yes | **No** | Removed |
| Failures @ 100 users | 0% | 0% | Stable |

Under heavy concurrency, latency is still dominated by **auth middleware DB work** (4 protected APIs × N users) and **remote PostgreSQL pool queueing** — not only the assets query.

---

## API usage

```bash
# Paginated (Assets screen default)
GET /api/assets?page=1&limit=50
# → { "rows": [...], "pagination": { "page": 1, "limit": 50, "total_count": 115, "total_pages": 3 } }

# Full list (modals, legacy callers)
GET /api/assets
# → [ ... ]  (array, unchanged)

# Explicit full list
GET /api/assets?all=true
```

---

## Recommended next steps

1. **Cache auth context** — avoid repeated `getUserWithBranch` / role lookups on every API call within the same JWT session
2. **Co-locate API and DB** on production server (Docker `alm_db` on same host)
3. **Server-side column filters** — so filtered views don’t need `all=true`
4. **`DB_POOL_MAX`** — ensure production pool size matches expected concurrency

---

## Re-run tests

```bash
cd AssetLifecycleBackend
LOAD_TEST_BASE_URL=http://localhost:4000 node scripts/load-test-assets-screen.js --concurrency 50
node scripts/load-test-assets-screen.js --concurrency 100 --iterations 2
```

Reports: `reports/assets-screen-load-*.json`
