const brHistModel = require('../models/assetMaintSchBrHistModel');

// GET /api/breakdown-history/reopened-breakdowns
// Returns breakdown maintenance schedules reopened more than once (RO count > 1).
// Optional query filters: assetId, assetTypeId, userId, deptId
async function getReopenedBreakdowns(req, res) {
  try {
    const org_id = req.query.orgId || req.user?.org_id;
    if (!org_id) {
      return res.status(400).json({ success: false, message: 'orgId is required' });
    }

    // Now drive the report from tblAssetMaintSch_BR_Hist (history) where status='RO'
    const rows = await brHistModel.getReopenedBreakdownsFromHistory({
      org_id,
      asset_id: req.query.assetId || null,
      asset_type_id: req.query.assetTypeId || null,
      user_id: req.query.userId || null,
      dept_id: req.query.deptId || null,
      reopen_count_min: req.query.reopenCountMin || null,
      last_reopened_on_from: req.query.lastReopenedOnFrom || null,
      last_reopened_on_to: req.query.lastReopenedOnTo || null,
    });

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
// Filter options for the Reopened Breakdowns report when driven from history (tblAssetMaintSch_BR_Hist).
async function getReopenedBreakdownsFilterOptions(req, res) {
  try {
    const org_id = req.query.orgId || req.user?.org_id;
    if (!org_id) {
      return res.status(400).json({ success: false, message: 'orgId is required' });
    }

    const filter_options = await brHistModel.getReopenedBreakdownsFilterOptionsFromHistory({
      org_id,
    });

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

    const rows = await brHistModel.getBrHistRowsForAmsId({
      org_id,
      ams_id: amsId,
    });

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

