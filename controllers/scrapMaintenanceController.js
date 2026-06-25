const scrapMaintenanceModel = require('../models/scrapMaintenanceModel');
const scrapApprovalCache = require('../utils/scrapApprovalCache');
const assetsDashboardCache = require('../utils/assetsDashboardCache');

function bustScrapCaches(req, orgId) {
  const oid = orgId || req.user?.org_id;
  scrapApprovalCache.invalidateOrgCaches(oid).catch(() => {});
  assetsDashboardCache.invalidateOrgApiCache(oid).catch(() => {});
}

// POST /api/scrap-maintenance/create
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

    bustScrapCaches(req, orgId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in createScrapRequest:', error);
    return res.status(500).json({ success: false, message: 'Failed to create scrap request', error: error.message });
  }
};

// POST /api/scrap-maintenance/create-from-group-selection
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

    bustScrapCaches(req, orgId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in createScrapRequestFromGroupSelection:', error);
    return res.status(500).json({ success: false, message: 'Failed to create scrap request', error: error.message });
  }
};

function collectUserRoleIds(user) {
  const ids = new Set();
  (user?.roles || []).forEach((role) => {
    if (role?.job_role_id) ids.add(role.job_role_id);
  });
  if (user?.job_role_id) ids.add(user.job_role_id);
  return [...ids];
}

// GET /api/scrap-maintenance/approvals
const getScrapMaintenanceApprovals = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const orgId = req.user?.org_id;
    let userBranchCode = req.user?.branch_code || req.user?.branchCode || null;
    const hasSuperAccess = req.user?.hasSuperAccess || false;
    const branchId = req.user?.branch_id;
    const roleIds = collectUserRoleIds(req.user);

    if (!userId || !orgId) {
      return res.status(400).json({ success: false, message: 'user_id/org_id missing in user context' });
    }

    const cacheKey = scrapApprovalCache.scopeKey(
      req,
      'scrap-approval',
      'list',
      userId,
      hasSuperAccess ? 'all' : (userBranchCode || branchId || 'none'),
    );

    const { data: rows } = await scrapApprovalCache.getOrSet(
      cacheKey,
      scrapApprovalCache.getTtlMs(),
      async () => {
        if (!hasSuperAccess && !userBranchCode && branchId) {
          userBranchCode = await scrapMaintenanceModel.getBranchCodeByBranchId(branchId);
        }
        return scrapMaintenanceModel.getScrapMaintenanceApprovals({
          orgId,
          userId,
          roleIds,
          userBranchCode,
          hasSuperAccess,
        });
      },
    );

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

    const cacheKey = scrapApprovalCache.scopeKey(req, 'scrap-approval', 'detail', id);
    const { data: detail } = await scrapApprovalCache.getOrSet(
      cacheKey,
      scrapApprovalCache.getTtlMs(),
      async () => scrapMaintenanceModel.getScrapApprovalDetailByHeaderId(id, orgId),
    );

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

    bustScrapCaches(req, orgId);
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

    bustScrapCaches(req, orgId);
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
        message: 'Workflow ID (wfscrap_h_id) is required',
      });
    }

    const cacheKey = scrapApprovalCache.scopeKey(req, 'scrap-approval', 'history', wfscrapHId);
    const { data: history } = await scrapApprovalCache.getOrSet(
      cacheKey,
      scrapApprovalCache.getTtlMs(),
      async () => scrapMaintenanceModel.getWorkflowHistoryByWfscrapHId(wfscrapHId, orgId),
    );

    return res.status(200).json({
      success: true,
      message: 'Workflow history retrieved successfully',
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error in getWorkflowHistory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve workflow history',
      error: error.message,
    });
  }
};

// GET /api/scrap-maintenance/asset-history
const getScrapAssetHistory = async (req, res) => {
  try {
    const { asset_id, ssh_id, scrap_type } = req.query;
    const orgId = req.query.orgId || req.user?.org_id || 'ORG001';

    const cacheKey = scrapApprovalCache.scopeKey(
      req,
      'scrap-approval',
      'asset-history',
      scrapApprovalCache.hashQuery({ asset_id, ssh_id, scrap_type }),
    );

    const { data: history } = await scrapApprovalCache.getOrSet(
      cacheKey,
      scrapApprovalCache.getTtlMs(),
      async () => scrapMaintenanceModel.getScrapAssetHistory({
        asset_id: asset_id || null,
        ssh_id: ssh_id || null,
        scrap_type: scrap_type || null,
        orgId,
      }),
    );

    return res.status(200).json({
      success: true,
      message: 'Scrap asset history retrieved successfully',
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error in getScrapAssetHistory:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve scrap asset history',
      error: error.message,
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
