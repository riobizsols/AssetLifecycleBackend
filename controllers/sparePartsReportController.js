const sparePartsReportModel = require('../models/sparePartsReportModel');

const getFilterOptions = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await sparePartsReportModel.getFilterOptions(
      orgId,
      req.user?.branch_id || null,
      Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    );
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[SparePartsReport] getFilterOptions:', err);
    return res.status(500).json({ error: err.message || 'Failed to load filter options' });
  }
};

const getReport = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await sparePartsReportModel.getSparePartsReport({
      orgId,
      category: req.query.category || req.query.categories || null,
      brand: req.query.brand || req.query.brands || null,
      currentStatus: req.query.currentStatus || req.query.status || null,
      purchaseDateFrom: req.query.purchaseDateFrom || req.query.purchase_from || null,
      purchaseDateTo: req.query.purchaseDateTo || req.query.purchase_to || null,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[SparePartsReport] getReport:', err);
    return res.status(500).json({ error: err.message || 'Failed to load spare parts report' });
  }
};

module.exports = {
  getFilterOptions,
  getReport,
};
