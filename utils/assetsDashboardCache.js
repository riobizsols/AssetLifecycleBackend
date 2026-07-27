const crypto = require('crypto');
const cacheService = require('../services/cacheService');

/** In-process L1 cache when Redis is unavailable or for hot keys */
const memoryL1 = new Map();

function memoryGet(key) {
  const entry = memoryL1.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryL1.delete(key);
    return null;
  }
  return entry.data;
}

function memorySet(key, data, ttlMs) {
  memoryL1.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function memoryInvalidatePrefix(prefix) {
  for (const key of memoryL1.keys()) {
    if (key.startsWith(prefix)) {
      memoryL1.delete(key);
    }
  }
}

/** Keys are scoped as api:{tenantDb}:{orgId}:{branch}:... — match org segment, not api:{orgId} */
function memoryInvalidateOrg(orgId) {
  if (!orgId) return 0;
  const marker = `:${orgId}:`;
  let deleted = 0;
  for (const key of memoryL1.keys()) {
    if (key.startsWith('api:') && key.includes(marker)) {
      memoryL1.delete(key);
      deleted += 1;
    }
  }
  return deleted;
}

function branchScope(req) {
  const hasSuperAccess = req.user?.hasSuperAccess || false;
  const branchId = req.user?.branch_id || null;
  return hasSuperAccess ? 'all' : (branchId || 'none');
}

function tenantScope(req) {
  const pool = req.db || req.tenantPool;
  if (pool?.options?.database) {
    return pool.options.database;
  }
  return req.isTenant ? 'tenant' : 'default';
}

function scopeKey(req, ...parts) {
  const orgId = req.user?.org_id || 'unknown';
  return cacheService.buildKey('api', tenantScope(req), orgId, branchScope(req), ...parts);
}

function hashQuery(value) {
  return crypto.createHash('md5').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

async function getOrSet(key, ttlMs, fetcher) {
  // Shared cache first (Redis when enabled) so create/update/delete invalidation
  // is visible across all API instances — do not return stale per-process L1 first.
  const cached = await cacheService.get(key);
  if (cached != null) {
    memorySet(key, cached, ttlMs);
    return { data: cached, fromCache: true };
  }

  // Shared miss — clear any stale local L1 entry for this key
  memoryL1.delete(key);

  const data = await fetcher();
  memorySet(key, data, ttlMs);
  await cacheService.set(key, data, ttlMs);
  return { data, fromCache: false };
}

async function invalidateOrgApiCache(orgId) {
  if (!orgId) return;
  // Org-scoped only — do NOT wipe all api:* keys (would clear every tenant on shared Redis)
  memoryInvalidateOrg(orgId);
  // Legacy prefix shape (api:{orgId}) for older keys
  memoryInvalidatePrefix(cacheService.buildKey('api', orgId));
  await cacheService.invalidateOrgApiKeys(orgId);
}

module.exports = {
  scopeKey,
  hashQuery,
  getOrSet,
  invalidateOrgApiCache,
  getDashboardTtlMs: () => cacheService.getDashboardCacheTtlMs(),
  getAssetsListTtlMs: () => cacheService.getAssetsListCacheTtlMs(),
};
