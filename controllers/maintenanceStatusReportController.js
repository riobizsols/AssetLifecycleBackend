const model = require('../models/maintenanceStatusReportModel');
const { exportToExcel } = require('../utils/exportUtils');

function parseAssetTypeIds(src) {
  return model.parseAssetTypeIds(src.asset_type_ids || src.assetTypeIds);
}

function orgIdFrom(req) {
  return req.user?.org_id;
}

const getOptions = async (req, res) => {
  try {
    const orgId = orgIdFrom(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const [facilityTypes, assetTypes] = await Promise.all([
      model.listFacilityAssetTypes(orgId),
      model.listAllAssetTypes(orgId),
    ]);

    return res.json({
      success: true,
      data: {
        facility_types: facilityTypes,
        asset_types: assetTypes,
      },
    });
  } catch (err) {
    console.error('[MaintenanceStatusReport] getOptions:', err);
    return res.status(500).json({ error: err.message || 'Failed to load filter options' });
  }
};

const viewReport = async (req, res) => {
  try {
    const orgId = orgIdFrom(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const src = req.method === 'GET' ? req.query : req.body || {};
    const data = await model.getMaintenanceStatusReport({
      orgId,
      assetTypeIds: parseAssetTypeIds(src),
      period: src.period || 'current_year',
      dateFrom: src.date_from || src.dateFrom || null,
      dateTo: src.date_to || src.dateTo || null,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[MaintenanceStatusReport] viewReport:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate maintenance status report' });
  }
};

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

const exportReport = async (req, res) => {
  try {
    const orgId = orgIdFrom(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const src = req.body || {};
    const data = await model.getMaintenanceStatusReport({
      orgId,
      assetTypeIds: parseAssetTypeIds(src),
      period: src.period || 'current_year',
      dateFrom: src.date_from || src.dateFrom || null,
      dateTo: src.date_to || src.dateTo || null,
      branchId: req.user?.branch_id || null,
      hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
    });

    const summaryRows = (data.summary?.by_asset_type || []).map((row) => ({
      'Asset Type': row.asset_type_name,
      Assets: row.asset_count,
      Due: row.due,
      Overdue: row.overdue,
      Completed: row.completed,
      Expiry: row.expiry,
    }));

    if (summaryRows.length === 0) {
      summaryRows.push({
        'Asset Type': '',
        Assets: data.summary?.totals?.assets || 0,
        Due: data.summary?.totals?.due || 0,
        Overdue: data.summary?.totals?.overdue || 0,
        Completed: data.summary?.totals?.completed || 0,
        Expiry: data.summary?.totals?.expiry || 0,
      });
    }

    const maintenanceRows = (data.details?.maintenance || []).map((row) => ({
      'Asset Type': row.asset_type_name,
      'Asset ID': row.asset_id,
      'Asset Name': row.asset_name,
      'Serial Number': row.serial_number,
      Branch: row.branch_name,
      'Work Order': row.wo_id,
      'Maintenance Type': row.maintenance_type_name,
      Status: row.compliance_status,
      'Due Date': formatDate(row.act_maint_st_date),
      'Completed Date': formatDate(row.act_main_end_date),
      Vendor: row.vendor_name,
    }));

    const expiryRows = (data.details?.expiry || []).map((row) => ({
      'Asset Type': row.asset_type_name,
      'Asset ID': row.asset_id,
      'Asset Name': row.asset_name,
      'Serial Number': row.serial_number,
      Branch: row.branch_name,
      Kind: row.expiry_kind,
      Warranty: formatDate(row.warranty_period),
      'Asset Expiry': formatDate(row.expiry_date),
    }));

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="maintenance-status-${stamp}.xlsx"`,
    );

    await exportToExcel(
      {
        Summary: summaryRows,
        Maintenance: maintenanceRows.length ? maintenanceRows : [{ 'Asset Type': 'No maintenance rows' }],
        Expiry: expiryRows.length ? expiryRows : [{ 'Asset Type': 'No expiry rows' }],
      },
      res,
    );
  } catch (err) {
    console.error('[MaintenanceStatusReport] exportReport:', err);
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
