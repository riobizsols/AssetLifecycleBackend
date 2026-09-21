const slaVendorPerformanceModel = require('../models/slaVendorPerformanceModel');

function parseListParam(value) {
  return slaVendorPerformanceModel.parseList(value);
}

function buildFilters(req) {
  const q = req.query || {};
  const orgId = req.user?.org_id;
  if (!orgId) {
    const err = new Error('Unauthorized - Missing organization ID');
    err.status = 401;
    throw err;
  }

  return {
    orgId,
    period: q.period || 'last_30_days',
    dateFrom: q.dateFrom || q.date_from || null,
    dateTo: q.dateTo || q.date_to || null,
    vendorIds: parseListParam(q.vendorIds || q.vendor_id || q.vendors),
    assetIds: parseListParam(q.assetIds || q.asset_id || q.assets),
    assetTypeIds: parseListParam(q.assetTypeIds || q.asset_type_id),
    branchIds: parseListParam(q.branchIds || q.branch_id || q.locations),
    maintTypeIds: parseListParam(q.maintTypeIds || q.maint_type_id),
    reasonIds: parseListParam(q.reasonIds || q.reason_id),
    slaStatus: q.slaStatus || q.sla_status || 'all',
    grain: q.grain || 'month',
    search: q.search ? String(q.search).trim() : null,
    sort: q.sort || 'delay_desc',
    page: q.page,
    pageSize: q.pageSize || q.page_size,
    vendorId: q.vendorId || q.vendor_id || null,
  };
}

function handle(fn) {
  return async (req, res) => {
    try {
      const filters = buildFilters(req);
      const data = await fn(filters, req);
      return res.json({ success: true, data });
    } catch (err) {
      console.error('[SlaVendorPerformance]', err);
      return res.status(err.status || 500).json({
        error: err.message || 'SLA vendor performance report failed',
      });
    }
  };
}

module.exports = {
  getFilterOptions: handle((f) => slaVendorPerformanceModel.getFilterOptions(f)),
  getSummary: handle((f) => slaVendorPerformanceModel.getSummary(f)),
  getTrends: handle((f) => slaVendorPerformanceModel.getTrends(f)),
  getBreaches: handle((f) => slaVendorPerformanceModel.getBreaches(f)),
  getVendors: handle((f) => slaVendorPerformanceModel.getVendors(f)),
  getVendorDetail: handle((f, req) => {
    const vendorId = req.params.vendorId || f.vendorId;
    return slaVendorPerformanceModel.getVendorDetail({ ...f, vendorId });
  }),
  getRepeatFailures: handle((f) => slaVendorPerformanceModel.getRepeatFailures(f)),
  getServiceQuality: handle((f) => slaVendorPerformanceModel.getServiceQuality(f)),
  getDetails: handle((f) => slaVendorPerformanceModel.getDetails(f)),
};
