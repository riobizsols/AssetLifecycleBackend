const model = require('../models/upcomingMaintenanceScheduleReportModel');
const { exportToExcel } = require('../utils/exportUtils');

function orgIdFrom(req) {
  return req.user?.org_id;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

function buildReportArgs(req) {
  const src = req.method === 'GET' ? req.query : req.body || {};
  return {
    orgId: orgIdFrom(req),
    assetTypeIds: model.parseAssetTypeIds(src.asset_type_ids || src.assetTypeIds),
    period: src.period || 'upcoming_90',
    dateFrom: src.date_from || src.dateFrom || null,
    dateTo: src.date_to || src.dateTo || null,
    scheduleStatus: src.schedule_status || src.scheduleStatus || 'ALL',
    branchId: req.user?.branch_id || null,
    hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
  };
}

const getOptions = async (req, res) => {
  try {
    const orgId = orgIdFrom(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const assetTypes = await model.listAllAssetTypes(orgId);
    return res.json({
      success: true,
      data: {
        asset_types: assetTypes,
        schedule_statuses: ['Upcoming', 'Due Today', 'Overdue', 'Completed', 'Rescheduled'],
      },
    });
  } catch (err) {
    console.error('[UpcomingMaintenanceScheduleReport] getOptions:', err);
    return res.status(500).json({ error: err.message || 'Failed to load filter options' });
  }
};

const viewReport = async (req, res) => {
  try {
    const args = buildReportArgs(req);
    if (!args.orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const data = await model.getUpcomingMaintenanceScheduleReport(args);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[UpcomingMaintenanceScheduleReport] viewReport:', err);
    return res.status(500).json({
      error: err.message || 'Failed to generate upcoming maintenance schedule report',
    });
  }
};

const exportReport = async (req, res) => {
  try {
    const args = buildReportArgs(req);
    if (!args.orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const data = await model.getUpcomingMaintenanceScheduleReport(args);
    const rows = (data.details || []).map((row) => ({
      'S.No.': row.sno,
      'Asset ID / Asset Code': row.asset_id,
      'Asset Name': row.asset_name,
      'Asset Type': row.asset_type_name,
      'Maintenance Type': row.maintenance_type,
      'Maintenance Schedule Date': formatDate(row.maintenance_schedule_date),
      'Last Maintenance Date': formatDate(row.last_maintenance_date),
      'Maintenance Frequency': row.maintenance_frequency,
      'Assigned Technician': row.assigned_technician,
      'Service Provider / Vendor': row.vendor_name,
      Priority: row.priority,
      'Schedule Status': row.schedule_status,
      'Warranty Status': row.warranty_status,
      'AMC / CMC Status': row.amc_cmc_status,
      'Work Order Number': row.wo_id,
      Remarks: row.remarks,
    }));

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="upcoming-maintenance-schedule-${stamp}.xlsx"`,
    );

    await exportToExcel(
      {
        Schedules: rows.length
          ? rows
          : [{ 'S.No.': '', 'Asset ID / Asset Code': 'No schedules in selected period' }],
      },
      res,
    );
  } catch (err) {
    console.error('[UpcomingMaintenanceScheduleReport] exportReport:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || 'Failed to export report' });
    }
  }
};

module.exports = {
  getOptions,
  viewReport,
  exportReport,
};
