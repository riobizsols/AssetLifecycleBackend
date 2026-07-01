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
  const l1 = memoryGet(key);
  if (l1 != null) {
    return { data: l1, fromCache: true };
  }

  const cached = await cacheService.get(key);
  if (cached != null) {
    memorySet(key, cached, ttlMs);
    return { data: cached, fromCache: true };
  }

  const data = await fetcher();
  memorySet(key, data, ttlMs);
  await cacheService.set(key, data, ttlMs);
  return { data, fromCache: false };
}

async function invalidateOrgApiCache(orgId) {
  if (!orgId) return;
  const prefix = cacheService.buildKey('api', orgId);
  memoryInvalidatePrefix(prefix);
  await cacheService.invalidateByPrefix(prefix);
}

module.exports = {
  scopeKey,
  hashQuery,
  getOrSet,
  invalidateOrgApiCache,
  getDashboardTtlMs: () => cacheService.getDashboardCacheTtlMs(),
  getAssetsListTtlMs: () => cacheService.getAssetsListCacheTtlMs(),
};
