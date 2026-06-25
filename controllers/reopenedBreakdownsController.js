const brHistModel = require('../models/assetMaintSchBrHistModel');
const reportsCache = require('../utils/reportsCache');

// GET /api/breakdown-history/reopened-breakdowns
async function getReopenedBreakdowns(req, res) {
  try {
    const org_id = req.query.orgId || req.user?.org_id;
    if (!org_id) {
      return res.status(400).json({ success: false, message: 'orgId is required' });
    }

    const filters = {
      org_id,
      asset_id: req.query.assetId || null,
      asset_type_id: req.query.assetTypeId || null,
      user_id: req.query.userId || null,
      dept_id: req.query.deptId || null,
      reopen_count_min: req.query.reopenCountMin || null,
      last_reopened_on_from: req.query.lastReopenedOnFrom || null,
      last_reopened_on_to: req.query.lastReopenedOnTo || null,
    };

    const { data: rows } = await reportsCache.cachedList(
      req,
      'reopened-breakdowns',
      filters,
      () => brHistModel.getReopenedBreakdownsFromHistory({
        org_id,
        asset_id: filters.asset_id,
        asset_type_id: filters.asset_type_id,
        user_id: filters.user_id,
        dept_id: filters.dept_id,
        reopen_count_min: filters.reopen_count_min,
        last_reopened_on_from: filters.last_reopened_on_from,
        last_reopened_on_to: filters.last_reopened_on_to,
      }),
    );

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error('Error fetching reopened breakdowns:', e);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reopened breakdowns',
      error: e?.message || String(e),
    });
  }
}

// GET /api/breakdown-history/reopened-breakdowns/filter-options
async function getReopenedBreakdownsFilterOptions(req, res) {
  try {
    const org_id = req.query.orgId || req.user?.org_id;
    if (!org_id) {
      return res.status(400).json({ success: false, message: 'orgId is required' });
    }

    const { data: filter_options } = await reportsCache.cachedFilterOptions(
      req,
      'reopened-breakdowns',
      () => brHistModel.getReopenedBreakdownsFilterOptionsFromHistory({ org_id }),
    );

    return res.json({ success: true, filter_options });
  } catch (e) {
    console.error('Error fetching reopened breakdown filter options:', e);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reopened breakdown filter options',
      error: e?.message || String(e),
    });
  }
}

// GET /api/breakdown-history/reopened-breakdowns/:amsId/history
async function getReopenedBreakdownBrHist(req, res) {
  try {
    const org_id = req.query.orgId || req.user?.org_id;
    const { amsId } = req.params;
    if (!org_id) {
      return res.status(400).json({ success: false, message: 'orgId is required' });
    }
    if (!amsId) {
      return res.status(400).json({ success: false, message: 'amsId is required' });
    }

    const { data: rows } = await reportsCache.cachedList(
      req,
      'reopened-breakdowns-history',
      { org_id, ams_id: amsId },
      () => brHistModel.getBrHistRowsForAmsId({ org_id, ams_id: amsId }),
    );

    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error('Error fetching BR history for AMS:', e);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch breakdown reopen history',
      error: e?.message || String(e),
    });
  }
}

module.exports = {
  getReopenedBreakdowns,
  getReopenedBreakdownsFilterOptions,
  getReopenedBreakdownBrHist,
};
