const assetsDashboardCache = require('./assetsDashboardCache');
const cacheService = require('../services/cacheService');

module.exports = {
  scopeKey: assetsDashboardCache.scopeKey,
  hashQuery: assetsDashboardCache.hashQuery,
  getOrSet: assetsDashboardCache.getOrSet,
  invalidateOrgCaches: assetsDashboardCache.invalidateOrgApiCache,
  getTtlMs: () => cacheService.getAssignmentCacheTtlMs(),
};
