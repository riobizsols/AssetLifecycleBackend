const auditReportModel = require('../models/auditReportModel');

function parseBoolSections(bodyOrQuery) {
  const src = bodyOrQuery?.sections || bodyOrQuery || {};
  const pick = (key, fallback = true) => {
    if (src[key] === undefined || src[key] === null || src[key] === '') return fallback;
    if (typeof src[key] === 'boolean') return src[key];
    return String(src[key]).toLowerCase() === 'true' || src[key] === '1' || src[key] === 1;
  };
  return {
    assetDetails: pick('assetDetails', true),
    maintenance: pick('maintenance', true),
    breakdown: pick('breakdown', true),
    certifications: pick('certifications', true),
    invoices: pick('invoices', true),
    purchaseOrders: pick('purchaseOrders', true),
  };
}

function parseAssetTypeIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const getAuditTypes = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });
    const data = await auditReportModel.listAuditTypes(orgId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[AuditReport] getAuditTypes:', err);
    return res.status(500).json({ error: err.message || 'Failed to load audit types' });
  }
};

const getMappedAssetTypes = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });
    const audtpId = req.params.audtpId || req.query.audtp_id;
    if (!audtpId) return res.status(400).json({ error: 'audtp_id is required' });
    const data = await auditReportModel.listMappedAssetTypes(orgId, audtpId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[AuditReport] getMappedAssetTypes:', err);
    return res.status(500).json({ error: err.message || 'Failed to load mapped asset types' });
  }
};

const viewAuditReport = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const src = req.method === 'GET' ? req.query : req.body || {};
    const audtpId = src.audtp_id || src.audtpId;
    const period = src.period || 'current_year';
    const assetTypeIds = parseAssetTypeIds(src.asset_type_ids || src.assetTypeIds);
    const sections = parseBoolSections(src);

    const data = await auditReportModel.getAuditReportView({
      orgId,
      audtpId,
      assetTypeIds,
      period,
      dateFrom: src.date_from || src.dateFrom || null,
      dateTo: src.date_to || src.dateTo || null,
      sections,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[AuditReport] viewAuditReport:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to build audit report' });
  }
};

const getPmCompliance = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const src = req.method === 'GET' ? req.query : req.body || {};
    const data = await auditReportModel.getPmCompliance({
      orgId,
      audtpId: src.audtp_id || src.audtpId,
      assetTypeIds: parseAssetTypeIds(src.asset_type_ids || src.assetTypeIds),
      period: src.period || 'current_year',
      dateFrom: src.date_from || src.dateFrom || null,
      dateTo: src.date_to || src.dateTo || null,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[AuditReport] getPmCompliance:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to load PM compliance' });
  }
};

const getCalibrationDetail = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const src = req.method === 'GET' ? req.query : req.body || {};
    const amsId = src.ams_id || src.amsId || req.params.amsId;
    const data = await auditReportModel.getCalibrationDetail({ orgId, amsId });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[AuditReport] getCalibrationDetail:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to load calibration detail' });
  }
};

module.exports = {
  getAuditTypes,
  getMappedAssetTypes,
  viewAuditReport,
  getPmCompliance,
  getCalibrationDetail,
};
