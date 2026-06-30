const { getRedis, isCacheEnabled } = require('../config/redis');

let warnedUnavailable = false;

/** In-process fallback when Redis is down — also speeds auth context on warm requests */
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
  const ttl = ttlMs && ttlMs > 0 ? ttlMs : 60000;
  memoryL1.set(key, { data, expiresAt: Date.now() + ttl });
}

function memoryDelete(key) {
  memoryL1.delete(key);
}

function memoryInvalidatePrefix(prefix) {
  if (!prefix) return 0;
  let deleted = 0;
  for (const key of memoryL1.keys()) {
    if (key.startsWith(prefix)) {
      memoryL1.delete(key);
      deleted += 1;
    }
  }
  return deleted;
}

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

function parseTtlMs(envValue, fallbackMs) {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

async function get(key) {
  const l1 = memoryGet(key);
  if (l1 != null) return l1;

  if (!isCacheEnabled()) return null;
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return null;

  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    if (!warnedUnavailable) {
      console.warn('[CacheService] get failed:', err.message);
      warnedUnavailable = true;
    }
    return null;
  }
}

async function set(key, value, ttlMs) {
  memorySet(key, value, ttlMs);

  if (!isCacheEnabled()) return true;
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return true;

  try {
    const payload = JSON.stringify(value);
    if (ttlMs && ttlMs > 0) {
      await redis.set(key, payload, 'PX', ttlMs);
    } else {
      await redis.set(key, payload);
    }
    return true;
  } catch (err) {
    if (!warnedUnavailable) {
      console.warn('[CacheService] set failed:', err.message);
      warnedUnavailable = true;
    }
    return true;
  }
}

async function del(key) {
  memoryDelete(key);

  if (!isCacheEnabled()) return true;
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return true;

  try {
    await redis.del(key);
    return true;
  } catch {
    return false;
  }
}

async function invalidateOrgApiKeys(orgId) {
  if (!orgId) return 0;
  let deleted = memoryInvalidateOrg(orgId);
  deleted += memoryInvalidatePrefix(buildKey('api', orgId));

  if (!isCacheEnabled()) return deleted;
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return deleted;

  const marker = `:${orgId}:`;
  let cursor = '0';

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'api:*', 'COUNT', 200);
      cursor = nextCursor;
      const toDelete = keys.filter((key) => key.includes(marker));
      if (toDelete.length > 0) {
        await redis.del(...toDelete);
        deleted += toDelete.length;
      }
    } while (cursor !== '0');
  } catch (err) {
    if (!warnedUnavailable) {
      console.warn('[CacheService] invalidateOrgApiKeys failed:', err.message);
      warnedUnavailable = true;
    }
  }

  return deleted;
}

async function invalidateByPrefix(prefix) {
  const memoryDeleted = memoryInvalidatePrefix(prefix);

  if (!isCacheEnabled() || !prefix) return memoryDeleted;
  const redis = getRedis();
  if (!redis || redis.status !== 'ready') return 0;

  let cursor = '0';
  let deleted = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    } while (cursor !== '0');
  } catch (err) {
    if (!warnedUnavailable) {
      console.warn('[CacheService] invalidateByPrefix failed:', err.message);
      warnedUnavailable = true;
    }
  }

  return deleted + memoryDeleted;
}

async function getOrSet(key, ttlMs, fetcher) {
  const cached = await get(key);
  if (cached != null) {
    return cached;
  }

  const data = await fetcher();
  await set(key, data, ttlMs);
  return data;
}

function buildKey(...parts) {
  return parts.filter((p) => p != null && p !== '').join(':');
}

function getAuthCacheTtlMs() {
  return parseTtlMs(process.env.AUTH_CACHE_TTL_MS, 120000);
}

function getTenantExistsCacheTtlMs() {
  return parseTtlMs(process.env.TENANT_EXISTS_CACHE_TTL_MS, 300000);
}

function getDashboardCacheTtlMs() {
  return parseTtlMs(process.env.DASHBOARD_CACHE_TTL_MS, 180000);
}

function getAssetsListCacheTtlMs() {
  return parseTtlMs(process.env.ASSETS_LIST_CACHE_TTL_MS, 120000);
}

function getAssignmentCacheTtlMs() {
  return parseTtlMs(process.env.ASSIGNMENT_CACHE_TTL_MS, 180000);
}

function getScrapApprovalCacheTtlMs() {
  return parseTtlMs(process.env.SCRAP_APPROVAL_CACHE_TTL_MS, 180000);
}

function getMaintenanceSupervisorCacheTtlMs() {
  return parseTtlMs(process.env.MAINTENANCE_SUPERVISOR_CACHE_TTL_MS, 180000);
}

function getReportsCacheTtlMs() {
  return parseTtlMs(process.env.REPORTS_CACHE_TTL_MS, 300000);
}

module.exports = {
  get,
  set,
  del,
  getOrSet,
  invalidateByPrefix,
  invalidateOrgApiKeys,
  buildKey,
  getAuthCacheTtlMs,
  getTenantExistsCacheTtlMs,
  getDashboardCacheTtlMs,
  getAssetsListCacheTtlMs,
  getAssignmentCacheTtlMs,
  getScrapApprovalCacheTtlMs,
  getMaintenanceSupervisorCacheTtlMs,
  getReportsCacheTtlMs,
};
