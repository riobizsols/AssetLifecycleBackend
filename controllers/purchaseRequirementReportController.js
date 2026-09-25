const model = require('../models/purchaseRequirementReportModel');
const { exportToExcel } = require('../utils/exportUtils');
const {
  ensureStockStatusNotificationsForOrg,
} = require('../models/stockStatusNotifyModel');

function orgIdFrom(req) {
  return req.user?.org_id;
}

function filtersFrom(req) {
  const src = req.method === 'GET' ? req.query : req.body || {};
  return {
    orgId: orgIdFrom(req),
    branchIds: model.parseList(src.branchIds || src.branch_ids || src.branches),
    categoryIds: model.parseList(src.categoryIds || src.category_ids || src.categories),
    focus: src.focus || src.view || 'all',
    horizonDays: model.parseHorizonDays(src.horizonDays || src.horizon_days || src.horizon, 30),
    branchId: req.user?.branch_id || null,
    hasSuperAccess: Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin),
  };
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

const getOptions = async (req, res) => {
  try {
    const orgId = orgIdFrom(req);
    if (!orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const [branches, categories] = await Promise.all([
      model.listBranches(orgId),
      model.listCategories(orgId),
    ]);

    return res.json({
      success: true,
      data: {
        branches,
        categories,
        focus_options: [
          { id: 'all', label: 'All parts' },
          { id: 'needs_purchase', label: 'Needs purchase' },
          { id: 'out_of_stock', label: 'Out of stock' },
        ],
        horizon_presets: [
          { id: 7, label: '7 days' },
          { id: 30, label: '30 days' },
          { id: 60, label: '60 days' },
          { id: 90, label: '90 days' },
        ],
      },
    });
  } catch (err) {
    console.error('[PurchaseRequirementReport] getOptions:', err);
    return res.status(500).json({ error: err.message || 'Failed to load filter options' });
  }
};

const viewReport = async (req, res) => {
  try {
    const filters = filtersFrom(req);
    if (!filters.orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const data = await model.getPurchaseRequirementReport(filters);
    // Fire stock alerts for newly out-of-stock / needs-purchase parts
    try {
      await ensureStockStatusNotificationsForOrg({ orgId: filters.orgId });
    } catch (notifyErr) {
      console.warn(
        '[PurchaseRequirementReport] stock notify skipped:',
        notifyErr.message,
      );
    }
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[PurchaseRequirementReport] viewReport:', err);
    return res.status(500).json({
      error: err.message || 'Failed to generate stock & purchase report',
    });
  }
};

const exportReport = async (req, res) => {
  try {
    const filters = filtersFrom(req);
    if (!filters.orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const data = await model.getPurchaseRequirementReport(filters);
    const detailRows = (data.rows || []).map((row) => ({
      'Part code': row.part_code,
      Description: row.description,
      UOM: row.uom || '',
      Branch: row.branch_name || row.branch_id || '',
      Status: (() => {
        const available = Number(row.available) || 0;
        const min =
          row.minimum_stock == null || row.minimum_stock === ''
            ? null
            : Number(row.minimum_stock);
        if (available <= 0) return 'Out of stock';
        if (min != null && !Number.isNaN(min) && min > 0 && available <= min) return 'Needs purchase';
        return '';
      })(),
      Available: row.available,
      'On hand': row.on_hand,
      'Min stock': row.minimum_stock ?? '',
      'Reorder level': row.re_order_level ?? '',
      Reserved: row.reserved,
      Requested: row.requested,
      'Upcoming PM': row.upcoming_pm_demand,
      'Open WOs': row.open_wo_count,
      'Avg usage 90d': row.avg_usage_90d,
      'Minimum qty': row.recommended_qty ?? row.minimum_stock ?? '',
      'Earliest demand': formatDate(row.earliest_demand_date),
    }));

    const summaryRows = [
      { Metric: 'Parts to buy', Value: data.summary?.totals?.parts_to_buy || 0 },
      { Metric: 'Out of stock', Value: data.summary?.totals?.out_of_stock || 0 },
      { Metric: 'With WO impact', Value: data.summary?.totals?.with_wo_impact || 0 },
      { Metric: 'With upcoming PM', Value: data.summary?.totals?.with_upcoming_pm || 0 },
      { Metric: 'Planning horizon (days)', Value: data.summary?.horizon_days || filters.horizonDays },
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="stock-purchase-${stamp}.xlsx"`,
    );

    await exportToExcel(
      {
        Summary: summaryRows,
        Details: detailRows.length
          ? detailRows
          : [{ 'Part code': '', Description: 'No matching parts' }],
      },
      res,
    );
  } catch (err) {
    console.error('[PurchaseRequirementReport] exportReport:', err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: err.message || 'Failed to export stock & purchase report',
      });
    }
  }
};

module.exports = {
  getOptions,
  viewReport,
  exportReport,
};
