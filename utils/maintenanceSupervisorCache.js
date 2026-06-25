const assetsDashboardCache = require('./assetsDashboardCache');
const cacheService = require('../services/cacheService');

module.exports = {
  scopeKey: assetsDashboardCache.scopeKey,
  getOrSet: assetsDashboardCache.getOrSet,
  invalidateOrgCaches: assetsDashboardCache.invalidateOrgApiCache,
  getTtlMs: () => cacheService.getMaintenanceSupervisorCacheTtlMs(),
};
