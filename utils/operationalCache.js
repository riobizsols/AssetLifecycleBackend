const assetsDashboardCache = require('./assetsDashboardCache');
const cacheService = require('../services/cacheService');

function listKey(req, slug, ...parts) {
  return assetsDashboardCache.scopeKey(req, 'ops', slug, ...parts);
}

async function cachedList(req, slug, parts, fetcher) {
  const keyParts = Array.isArray(parts) ? parts : [parts];
  return assetsDashboardCache.getOrSet(
    listKey(req, slug, ...keyParts),
    cacheService.getAssignmentCacheTtlMs(),
    fetcher,
  );
}

module.exports = {
  scopeKey: assetsDashboardCache.scopeKey,
  hashQuery: assetsDashboardCache.hashQuery,
  getOrSet: assetsDashboardCache.getOrSet,
  invalidateOrgCaches: assetsDashboardCache.invalidateOrgApiCache,
  getTtlMs: () => cacheService.getAssignmentCacheTtlMs(),
  listKey,
  cachedList,
};
