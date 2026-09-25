const model = require('../models/outOfStockReportModel');
const { exportToExcel } = require('../utils/exportUtils');

function orgIdFrom(req) {
  return req.user?.org_id;
}

function filtersFrom(req) {
  const src = req.method === 'GET' ? req.query : req.body || {};
  return {
    orgId: orgIdFrom(req),
    branchIds: model.parseList(src.branchIds || src.branch_ids || src.branches),
    storeIds: model.parseList(src.storeIds || src.store_ids || src.stores),
    categoryIds: model.parseList(src.categoryIds || src.category_ids || src.categories),
    impact: src.impact || 'all',
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

    const branchId = req.user?.branch_id || null;
    const hasSuperAccess = Boolean(req.user?.hasSuperAccess || req.user?.is_super_admin);

    const [branches, stores, categories] = await Promise.all([
      model.listBranches(orgId),
      model.listStores(orgId, hasSuperAccess ? null : branchId),
      model.listCategories(orgId),
    ]);

    return res.json({
      success: true,
      data: {
        branches,
        stores,
        categories,
        impact_levels: [
          { id: 'all', label: 'All' },
          { id: 'open_wo', label: 'Open work order' },
          { id: 'upcoming_pm', label: 'Upcoming PM' },
          { id: 'no_demand', label: 'No immediate demand' },
        ],
      },
    });
  } catch (err) {
    console.error('[OutOfStockReport] getOptions:', err);
    return res.status(500).json({ error: err.message || 'Failed to load filter options' });
  }
};

const viewReport = async (req, res) => {
  try {
    const filters = filtersFrom(req);
    if (!filters.orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const data = await model.getOutOfStockReport(filters);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[OutOfStockReport] viewReport:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate out of stock report' });
  }
};

const exportReport = async (req, res) => {
  try {
    const filters = filtersFrom(req);
    if (!filters.orgId) return res.status(401).json({ error: 'Unauthorized - Missing organization ID' });

    const data = await model.getOutOfStockReport(filters);
    const detailRows = (data.rows || []).map((row) => ({
      'Part code': row.part_code,
      Description: row.description,
      UOM: row.uom || '',
      Branch: row.branch_name || row.branch_id || '',
      'On hand': row.on_hand,
      Reserved: row.reserved,
      Blocked: row.blocked,
      Available: row.available,
      Requested: row.requested,
      'Stock-out start': formatDate(row.stock_out_start_date),
      'Affected assets': row.affected_asset_count,
      'Open WOs': row.open_wo_count,
      'Upcoming PM': row.upcoming_pm_count,
      'Work orders': row.work_order_numbers || '',
      'Earliest required': formatDate(row.earliest_required_date),
      'Alt branch available': row.alt_branch_available,
      'Min stock': row.minimum_stock ?? '',
      'Reorder level': row.re_order_level ?? '',
    }));

    const summaryRows = [
      {
        Metric: 'Out of stock parts',
        Value: data.summary?.totals?.out_of_stock_parts || 0,
      },
      {
        Metric: 'With open work orders',
        Value: data.summary?.totals?.with_open_wo || 0,
      },
      {
        Metric: 'With upcoming PM',
        Value: data.summary?.totals?.with_upcoming_pm || 0,
      },
      {
        Metric: 'On-hand but no available',
        Value: data.summary?.totals?.with_on_hand_no_available || 0,
      },
      {
        Metric: 'Alt branch has stock',
        Value: data.summary?.totals?.with_alt_branch_stock || 0,
      },
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="out-of-stock-${stamp}.xlsx"`);

    await exportToExcel(
      {
        Summary: summaryRows,
        Details: detailRows.length
          ? detailRows
          : [{ 'Part code': '', Description: 'No out-of-stock parts' }],
      },
      res,
    );
  } catch (err) {
    console.error('[OutOfStockReport] exportReport:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message || 'Failed to export out of stock report' });
    }
  }
};

module.exports = {
  getOptions,
  viewReport,
  exportReport,
};
