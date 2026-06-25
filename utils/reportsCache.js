const assetsDashboardCache = require('./assetsDashboardCache');
const cacheService = require('../services/cacheService');

function listKey(req, reportSlug, filters) {
  return assetsDashboardCache.scopeKey(
    req,
    'reports',
    reportSlug,
    'list',
    assetsDashboardCache.hashQuery(filters),
  );
}

function filterOptionsKey(req, reportSlug) {
  return assetsDashboardCache.scopeKey(req, 'reports', reportSlug, 'filter-options');
}

function summaryKey(req, reportSlug) {
  return assetsDashboardCache.scopeKey(req, 'reports', reportSlug, 'summary');
}

async function cachedList(req, reportSlug, filters, fetcher) {
  return assetsDashboardCache.getOrSet(
    listKey(req, reportSlug, filters),
    cacheService.getReportsCacheTtlMs(),
    fetcher,
  );
}

async function cachedFilterOptions(req, reportSlug, fetcher) {
  return assetsDashboardCache.getOrSet(
    filterOptionsKey(req, reportSlug),
    cacheService.getReportsCacheTtlMs(),
    fetcher,
  );
}

async function cachedSummary(req, reportSlug, fetcher) {
  return assetsDashboardCache.getOrSet(
    summaryKey(req, reportSlug),
    cacheService.getReportsCacheTtlMs(),
    fetcher,
  );
}

module.exports = {
  scopeKey: assetsDashboardCache.scopeKey,
  hashQuery: assetsDashboardCache.hashQuery,
  getOrSet: assetsDashboardCache.getOrSet,
  invalidateOrgCaches: assetsDashboardCache.invalidateOrgApiCache,
  getTtlMs: () => cacheService.getReportsCacheTtlMs(),
  listKey,
  filterOptionsKey,
  summaryKey,
  cachedList,
  cachedFilterOptions,
  cachedSummary,
};
