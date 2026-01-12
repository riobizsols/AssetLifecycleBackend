const express = require('express');
const router = express.Router();
const { getApprovalDetail, getApprovalDetailByWfamshId, approveMaintenanceAction, rejectMaintenanceAction, getWorkflowHistory, getWorkflowHistoryByWfamshId, getMaintenanceApprovals, getVendorRenewalApprovals, getAllMaintenanceWorkflows } = require('../controllers/approvalDetailController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get maintenance approvals for the current user
// GET /api/approval-detail/maintenance-approvals
router.get("/maintenance-approvals", getMaintenanceApprovals);

// Get vendor renewal approvals for the current user (MT005 only)
// GET /api/approval-detail/vendor-renewal-approvals
router.get("/vendor-renewal-approvals", getVendorRenewalApprovals);

// Get workflow history for an asset
router.get("/history/:assetId", getWorkflowHistory);

// Get workflow history by wfamsh_id (specific workflow)
router.get("/workflow-history/:wfamshId", getWorkflowHistoryByWfamshId);

// Get all maintenance workflows for an asset (separated by wfamsh_id)
// GET /api/approval-detail/workflows/:assetId
router.get('/workflows/:assetId', getAllMaintenanceWorkflows);

// Get approval detail by wfamsh_id (specific workflow)
// GET /api/approval-detail/workflow/:wfamshId
router.get('/workflow/:wfamshId', getApprovalDetailByWfamshId);

// Get approval detail by asset ID
// GET /api/approval-detail/:assetId
router.get('/:assetId', getApprovalDetail);

// Approve maintenance
// POST /api/approval-detail/:assetId/approve
router.post('/:assetId/approve', approveMaintenanceAction);

// Reject maintenance
// POST /api/approval-detail/:assetId/reject
router.post('/:assetId/reject', rejectMaintenanceAction);

module.exports = router; 