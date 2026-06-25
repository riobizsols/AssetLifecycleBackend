# Backend API Performance Report

**Project:** Asset Lifecycle Management  
**Date:** June 5, 2026  
**Environment:** Local dev — `http://localhost:4000/api` | Org: `ORG001` | Test user: `USR020`  
**Benchmark script:** `scripts/benchmark-api-part.js`

---

## Executive summary

Backend list and report APIs were averaging **~2.2 seconds per request** — effectively unusable for fast UI navigation. After investigation and fixes, the same APIs now respond in **~50–120ms on first load (cold)** and **~2–7ms on repeat loads (warm)** — a **~97% improvement** on warm requests.

The main bottleneck was **not** the database queries themselves. `checkTenantExists()` runs on every authenticated request and was pointing at the **wrong IP** in `TENANT_DATABASE_URL` (`103.73.190.251`), causing a **~2-second connection timeout** per API call. **Primary fix:** corrected the IP in `.env` to a reachable host. **Additional hardening:** cache tenant lookup results (including failures), in-memory L1 cache fallback, and removing redundant auth lookups.

---

## Before vs after (overall)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Typical API response (cold) | ~2,200ms | ~57–126ms | **~95% faster** |
| Typical API response (warm) | ~2,180ms | ~3–7ms | **~99.7% faster** |
| Asset types (worst case) | ~10,945ms | ~53ms cold / ~5ms warm | **~99.5% faster** |
| Cache benefit on warm requests | ~1–2% | ~90–97% | Caching now works |

---

## Root cause

| Issue | Impact |
|-------|--------|
| **Wrong IP in `TENANT_DATABASE_URL`** | `checkTenantExists()` hit `103.73.190.251` (unreachable) on every request → ~2s timeout |
| `checkTenantExists()` on every authenticated request | Auth middleware calls tenant lookup before any list/report handler runs |
| Failed tenant lookups were **not cached** (code gap) | Even after IP fix, a future bad URL would still penalize every request until cached |
| Redis not running locally | Operational cache had no shared L1 fallback initially |
| Controllers re-fetching user/branch data | Extra DB round-trips on vendors, maintenance approvals, etc. |

**Proof:** Raw DB query for departments = ~238ms. Raw DB query for asset types = ~49ms. HTTP response before fix = ~2,200ms. The gap was tenant registry connection timeout, not slow SQL.

**Config fix (primary):** `TENANT_DATABASE_URL` updated in `.env` from wrong IP `103.73.190.251` → reachable IP `103.192.199.178`.

---

## Fixes applied

| # | Where | Change |
|---|-------|--------|
| 1 | **`.env`** | **Corrected `TENANT_DATABASE_URL` IP** — wrong `103.73.190.251` → reachable `103.192.199.178` |
| 2 | `services/tenantService.js` | Cache `{ exists: false }` when tenant registry is unreachable (defensive) |
| 3 | `services/cacheService.js` | In-memory L1 cache fallback when Redis is down |
| 4 | `middlewares/authMiddleware.js` | Check auth cache before `buildUserContext`; skip redundant tenant path when `use_default_db` |
| 5 | `controllers/vendorsController.js` | Use `req.user.branch_code` from auth instead of re-querying DB |
| 6 | `controllers/approvalDetailController.js` | Same — remove redundant branch lookup on maintenance approvals |
| 7 | `scripts/benchmark-api-part.js` | Correct paths for report breakdown & paginated reports |
| 8 | `utils/reqUserBranch.js` | Shared helper — `branchCodeFromReq(req)` from auth context |
| 9 | `controllers/assetGroupController.js` | Auth branch, cache before logging, invalidate on mutations |
| 10 | `controllers/scrapSalesController.js` | Auth branch, cache before logging |
| 11 | `controllers/assetController.js` | `operationalCache` on `getAllAssets` (`/all-assets`) |
| 12 | `useReportState.js` + `reportCache.js` | SLA report wired to `loadReportData` / prefetch cache |

---

## Part-by-part results (after fixes)

### Part 1 — Master data lists

| API | Before cold | Before warm | After cold | After warm | Cache gain |
|-----|-------------|-------------|------------|------------|------------|
| Departments | 2,184ms | 2,182ms | 99ms | 5ms | 95% |
| Branches | 2,225ms | 2,180ms | 47ms | 2ms | 96% |
| Vendors | 2,306ms | 2,268ms | 54ms | 3ms | 95% |
| Asset types | 10,945ms | 10,869ms | 53ms | 5ms | 90% |
| Users | 2,233ms | 2,179ms | 47ms | 2ms | 95% |
| Job roles | 2,221ms | 2,183ms | 42ms | 2ms | 96% |

**Part 1 average:** 57ms cold | 3ms warm | 94% cache gain  
**Status:** Complete

---

### Part 2 — Admin configuration

| API | Cold | Warm | Cache gain |
|-----|------|------|------------|
| Properties with values | 72ms | 3ms | 95% |
| Breakdown reason codes | 46ms | 3ms | 93% |
| Workflow steps | 137ms | 3ms | 98% |
| Maintenance frequencies | 66ms | 5ms | 93% |
| Maintenance types | 42ms | 2ms | 95% |
| UOM | 133ms | 9ms | 93% |
| Text messages default | 93ms | 4ms | 95% |
| Job monitor jobs | 326ms | 3ms | 99% |
| Tech certificates | 138ms | 3ms | 98% |
| Asset types (maint required) | 62ms | 3ms | 94% |

**Part 2 average:** 112ms cold | 4ms warm | 97% cache gain  
**Status:** Good — no further action needed

---

### Part 3 — Inspection & certifications

| API | Cold | Warm | Cache gain |
|-----|------|------|------------|
| Inspection frequencies | 73ms | 5ms | 93% |
| Inspection checklists | 107ms | 22ms | 80% |
| Checklist response types | 60ms | 8ms | 87% |
| Inspection certificates | 102ms | 3ms | 97% |
| Audit log configs | 48ms | 5ms | 90% |
| App events apps | 51ms | 4ms | 91% |
| App events events | 45ms | 4ms | 92% |

**Part 3 average:** 69ms cold | 7ms warm | 90% cache gain  
**Status:** Good

---

### Part 4 — Operations & approvals (optimized)

| API | Before cold | Before warm | After cold | After warm | Cache gain | Notes |
|-----|-------------|-------------|------------|------------|------------|-------|
| Work orders | 96ms | 4ms | 112ms | 6ms | 95% | OK |
| Maintenance approvals | 44ms | 6ms | 55ms | 4ms | 93% | Removed redundant branch DB lookup |
| Inspection approvals | 54ms | 17ms | 67ms | 3ms | 95% | OK |
| Asset groups | **327ms** | **93ms** | **90ms** | **4ms** | 96% | Fixed — auth branch + cache invalidation |
| Scrap sales | **148ms** | **85ms** | 478ms* | **3ms** | 99% | Fixed — auth branch; *cold varies with DB |
| Assets list | — | — | 55ms | 4ms | 93% | Added `operationalCache` on `/all-assets` |
| Report breakdown | 88ms | 4ms | 192ms | 4ms | 98% | OK |

**Part 4 average:** 150ms cold | 4ms warm | 97% cache gain  
**Status:** Complete

---

### Part 5 — Reports

| API | Cold | Warm | Cache gain |
|-----|------|------|------------|
| Maintenance history | 103ms | 5ms | 95% |
| Breakdown history | 111ms | 4ms | 97% |
| Asset register | 111ms | 6ms | 94% |
| Asset lifecycle | 118ms | 4ms | 97% |
| Asset workflow history | 121ms | 5ms | 96% |
| Asset valuation | 141ms | 4ms | 97% |

**Part 5 average:** 118ms cold | 5ms warm | 96% cache gain  
**Status:** Complete

---

## Remaining items (optional follow-up)

| Item | Priority | Notes |
|------|----------|-------|
| Enable Redis in staging/prod | Low | L1 memory works per server; Redis shares cache across instances |
| Verify `TENANT_DATABASE_URL` in all envs | Low | Fixed locally — confirm staging/prod |
| Scrap sales cold latency | Low | Warm cache is 3ms; cold can spike on first query (~400ms+) |
| Event logging before cache | Low | Minor cold-hit savings on some controllers |

---

## How to re-run benchmarks

```bash
cd AssetLifecycleBackend
node scripts/benchmark-api-part.js 1   # Master data
node scripts/benchmark-api-part.js 2   # Admin config
node scripts/benchmark-api-part.js 3   # Inspection & certs
node scripts/benchmark-api-part.js 4   # Operations
node scripts/benchmark-api-part.js 5   # Reports
```

---

## Text message summary for team lead

Copy-paste ready:

```
Hi, quick update on Asset Lifecycle backend performance:

We benchmarked all list/report APIs (40+ endpoints across 5 groups). Before fixes, every API was taking ~2.2 sec (asset types up to 11 sec). Root cause: wrong IP in TENANT_DATABASE_URL — tenant check timed out ~2s on EVERY request, not slow queries.

Fixes done:
• Corrected TENANT_DATABASE_URL IP in .env (main fix)
• Cache failed tenant lookups (defensive)
• In-memory cache when Redis is down
• Auth cache fast-path
• Removed duplicate user/branch DB calls

Results:
• Cold (first load): ~2,200ms → ~50–120ms (~95% faster)
• Warm (cached): ~2,180ms → ~3–7ms (~99.7% faster)
• All 5 API groups tested. Parts 1, 2, 3, 5 are good.
• Part 4: asset groups (327ms) & scrap sales still need tuning.

Full report: AssetLifecycleBackend/docs/API_PERFORMANCE_REPORT.md
```

---

*Report generated from benchmark runs on June 5, 2026.*
