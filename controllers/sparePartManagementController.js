const sparePartManagementModel = require('../models/sparePartManagementModel');

const getSummary = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await sparePartManagementModel.getSparePartManagementSummary(
      orgId,
      req.user?.branch_id || null,
      Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    );
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[SparePartManagement] getSummary:', err);
    return res.status(500).json({ error: err.message || 'Failed to load summary' });
  }
};

const getSlowNonMoving = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await sparePartManagementModel.getSlowNonMovingInventory({
      orgId,
      thresholdDays: req.query.threshold_days || req.query.thresholdDays || 180,
      poNumber: req.query.po_number || req.query.poNumber || null,
      invoiceNumber: req.query.invoice_number || req.query.invoiceNumber || null,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[SparePartManagement] getSlowNonMoving:', err);
    return res.status(500).json({ error: err.message || 'Failed to load slow/non-moving inventory' });
  }
};

const getConsumption = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await sparePartManagementModel.getSpareConsumption({
      orgId,
      dateFrom: req.query.date_from || req.query.dateFrom || null,
      dateTo: req.query.date_to || req.query.dateTo || null,
      poNumber: req.query.po_number || req.query.poNumber || null,
      invoiceNumber: req.query.invoice_number || req.query.invoiceNumber || null,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[SparePartManagement] getConsumption:', err);
    return res.status(500).json({ error: err.message || 'Failed to load spare consumption' });
  }
};

const getEquipmentWise = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await sparePartManagementModel.getEquipmentWiseConsumption({
      orgId,
      dateFrom: req.query.date_from || req.query.dateFrom || null,
      dateTo: req.query.date_to || req.query.dateTo || null,
      assetId: req.query.asset_id || req.query.assetId || null,
      poNumber: req.query.po_number || req.query.poNumber || null,
      invoiceNumber: req.query.invoice_number || req.query.invoiceNumber || null,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[SparePartManagement] getEquipmentWise:', err);
    return res.status(500).json({ error: err.message || 'Failed to load equipment-wise consumption' });
  }
};

const getHoldDuration = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await sparePartManagementModel.getHoldDuration({
      orgId,
      dateFrom: req.query.date_from || req.query.dateFrom || null,
      dateTo: req.query.date_to || req.query.dateTo || null,
      poNumber: req.query.po_number || req.query.poNumber || null,
      invoiceNumber: req.query.invoice_number || req.query.invoiceNumber || null,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[SparePartManagement] getHoldDuration:', err);
    return res.status(500).json({ error: err.message || 'Failed to load hold duration' });
  }
};

module.exports = {
  getSummary,
  getSlowNonMoving,
  getConsumption,
  getEquipmentWise,
  getHoldDuration,
};
