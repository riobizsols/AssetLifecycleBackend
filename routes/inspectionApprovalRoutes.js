const express = require('express');
const router = express.Router();
const controller = require('../controllers/inspectionApprovalController');
const { protect } = require('../middlewares/authMiddleware');

/**
 * INSPECTION APPROVAL ROUTES
 * Phase 2: Maintenance Approval Workflow
 */

// Apply auth middleware to all routes
router.use(protect);

// CHUNK 2.1: READ OPERATIONS

// Get pending approvals for the current user (requires jobRoleId in query)
// GET /api/inspection-approval/pending?jobRoleId=JR001
router.get('/pending', controller.getPendingApprovals);

// Get detailed information for a specific inspection workflow
// GET /api/inspection-approval/detail/:wfaiish_id
router.get('/detail/:wfaiish_id', controller.getInspectionDetail);

// Get workflow history for a specific inspection
// GET /api/inspection-approval/history/:wfaiish_id
router.get('/history/:wfaiish_id', controller.getInspectionHistory);


// CHUNK 2.2: WRITE OPERATIONS (ACTIONS)

// Process approval or rejection action
// POST /api/inspection-approval/action
// Body: { action: 'APPROVE'|'REJECT', wfaiisd_id: '...', comments: '...' }
router.post('/action', controller.processApprovalAction);

module.exports = router;
