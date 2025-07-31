const express = require('express');
const router = express.Router();
const { getApprovalDetail, approveMaintenanceAction, rejectMaintenanceAction, getWorkflowHistory, getMaintenanceApprovals } = require('../controllers/approvalDetailController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get maintenance approvals for the current user
// GET /api/approval-detail/maintenance-approvals
router.get("/maintenance-approvals", getMaintenanceApprovals);

// Get workflow history for an asset
router.get("/history/:assetId", getWorkflowHistory);

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