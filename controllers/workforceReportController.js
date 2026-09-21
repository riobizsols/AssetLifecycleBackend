const workforceReportModel = require('../models/workforceReportModel');

const viewWorkforceReport = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const src = req.method === 'GET' ? req.query : req.body || {};
    const data = await workforceReportModel.getWorkforceReport({
      orgId,
      period: src.period || 'current_year',
      dateFrom: src.date_from || src.dateFrom || null,
      dateTo: src.date_to || src.dateTo || null,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[WorkforceReport] viewWorkforceReport:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to load workforce report' });
  }
};

const getTechnicianDetail = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const src = req.method === 'GET' ? req.query : req.body || {};
    const data = await workforceReportModel.getTechnicianDetail({
      orgId,
      empIntId: src.emp_int_id || src.empIntId || null,
      name: src.name || src.technician_name || null,
      email: src.email || src.technician_email || null,
      phone: src.phone || src.technician_phno || null,
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[WorkforceReport] getTechnicianDetail:', err);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Failed to load technician details' });
  }
};

module.exports = {
  viewWorkforceReport,
  getTechnicianDetail,
};
