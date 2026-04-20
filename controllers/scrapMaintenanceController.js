const scrapMaintenanceModel = require('../models/scrapMaintenanceModel');

// POST /api/scrap-maintenance/create
// Body: { asset_id?: string, assetgroup_id?: string, is_scrap_sales?: 'Y'|'N' }
const createScrapRequest = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    const userId = req.user?.user_id;
    const branchId = req.user?.branch_id;

    const { asset_id = null, assetgroup_id = null, is_scrap_sales = 'N', notes = null } = req.body || {};

    if (!orgId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await scrapMaintenanceModel.createScrapRequest({
      orgId,
      userId,
      branchId,
      asset_id,
      assetgroup_id,
      is_scrap_sales: is_scrap_sales === 'Y' ? 'Y' : 'N',
      request_notes: notes,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in createScrapRequest:', error);
    return res.status(500).json({ success: false, message: 'Failed to create scrap request', error: error.message });
  }
};

// POST /api/scrap-maintenance/create-from-group-selection
// Body: { assetgroup_id: string, asset_ids: string[], is_scrap_sales?: 'Y'|'N', notes?: string }
const createScrapRequestFromGroupSelection = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    const userId = req.user?.user_id;
    const branchId = req.user?.branch_id;

    const { assetgroup_id, asset_ids, is_scrap_sales = 'N', notes = null } = req.body || {};

    if (!orgId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await scrapMaintenanceModel.createScrapRequestFromGroupSelection({
      orgId,
      userId,
      branchId,
      assetgroup_id,
      asset_ids,
      is_scrap_sales: is_scrap_sales === 'Y' ? 'Y' : 'N',
      request_notes: notes,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in createScrapRequestFromGroupSelection:', error);
    return res.status(500).json({ success: false, message: 'Failed to create scrap request', error: error.message });
  }
};

// GET /api/scrap-maintenance/approvals
const getScrapMaintenanceApprovals = async (req, res) => {
  try {
    const empIntId = req.user?.emp_int_id;
    const orgId = req.user?.org_id;
    let userBranchCode = req.user?.branch_code || req.user?.branchCode || null;
    const hasSuperAccess = req.user?.hasSuperAccess || false;
    const branchId = req.user?.branch_id;

    if (!empIntId || !orgId) {
      return res.status(400).json({ success: false, message: 'emp_int_id/org_id missing in user context' });
    }

    if (!hasSuperAccess && !userBranchCode && branchId) {
      userBranchCode = await scrapMaintenanceModel.getBranchCodeByBranchId(branchId);
    }

    const rows = await scrapMaintenanceModel.getScrapMaintenanceApprovals(
      empIntId,
      orgId,
      userBranchCode,
      hasSuperAccess
    );

    console.log('[ScrapMaintenanceApprovals] fetched:', {
      empIntId,
      orgId,
      userBranchCode,
      hasSuperAccess,
      count: rows.length,
    });

    return res.status(200).json({ success: true, count: rows.length, approvals: rows });
  } catch (error) {
    console.error('Error in getScrapMaintenanceApprovals:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch scrap approvals', error: error.message });
  }
};

// GET /api/scrap-maintenance/workflow/:id
const getScrapApprovalDetail = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    const { id } = req.params;

    const detail = await scrapMaintenanceModel.getScrapApprovalDetailByHeaderId(id, orgId);
    if (!detail) {
      return res.status(404).json({ success: false, message: 'Scrap workflow not found' });
    }

    return res.status(200).json({ success: true, ...detail });
  } catch (error) {
    console.error('Error in getScrapApprovalDetail:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch scrap workflow detail', error: error.message });
  }
};

// POST /api/scrap-maintenance/:id/approve
const approveScrap = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    const empIntId = req.user?.emp_int_id;
    const { id } = req.params;
    const { note = null } = req.body || {};

    const result = await scrapMaintenanceModel.approveScrapWorkflow({
      wfscrap_h_id: id,
      empIntId,
      note,
      orgId,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in approveScrap:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve scrap workflow', error: error.message });
  }
};

// POST /api/scrap-maintenance/:id/reject
const rejectScrap = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    const empIntId = req.user?.emp_int_id;
    const { id } = req.params;
    const { reason = null } = req.body || {};

    const result = await scrapMaintenanceModel.rejectScrapWorkflow({
      wfscrap_h_id: id,
      empIntId,
      reason,
      orgId,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in rejectScrap:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject scrap workflow', error: error.message });
  }
};

// GET /api/scrap-maintenance/workflow-history/:wfscrapHId
const getWorkflowHistory = async (req, res) => {
  try {
    const { wfscrapHId } = req.params;
    const orgId = req.query.orgId || req.user?.org_id || 'ORG001';

    if (!wfscrapHId) {
      return res.status(400).json({
        success: false,
        message: 'Workflow ID (wfscrap_h_id) is required'
      });
    }

    const history = await scrapMaintenanceModel.getWorkflowHistoryByWfscrapHId(wfscrapHId, orgId);

    return res.status(200).json({
      success: true,
      message: 'Workflow history retrieved successfully',
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error in getWorkflowHistory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve workflow history',
      error: error.message
    });
  }
};

// GET /api/scrap-maintenance/asset-history
const getScrapAssetHistory = async (req, res) => {
  try {
    const { asset_id, ssh_id, scrap_type } = req.query;
    const orgId = req.query.orgId || req.user?.org_id || 'ORG001';

    const history = await scrapMaintenanceModel.getScrapAssetHistory({
      asset_id: asset_id || null,
      ssh_id: ssh_id || null,
      scrap_type: scrap_type || null,
      orgId
    });

    return res.status(200).json({
      success: true,
      message: 'Scrap asset history retrieved successfully',
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error in getScrapAssetHistory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve scrap asset history',
      error: error.message
    });
  }
};

module.exports = {
  createScrapRequest,
  createScrapRequestFromGroupSelection,
  getScrapMaintenanceApprovals,
  getScrapApprovalDetail,
  approveScrap,
  rejectScrap,
  getWorkflowHistory,
  getScrapAssetHistory,
};

