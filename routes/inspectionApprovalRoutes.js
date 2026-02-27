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

// Get asset types for which certified technicians are available (must be before /technicians/:id)
// GET /api/inspection-approval/asset-types-with-technicians
router.get('/asset-types-with-technicians', controller.getAssetTypesWithCertifiedTechnicians);

// Get certified technicians for a specific asset type
// GET /api/inspection-approval/technicians/:assetTypeId
router.get('/technicians/:assetTypeId', controller.getCertifiedTechnicians);

// Get technician details from workflow header (for inhouse maintained assets)
// GET /api/inspection-approval/technician-header/:empIntId
router.get('/technician-header/:empIntId', controller.getTechnicianFromHeader);

// Update workflow header (vendor or planned date)
// PUT /api/inspection-approval/workflow-header/:wfaiishId
router.put('/workflow-header/:wfaiishId', controller.updateWorkflowHeader);


// CHUNK 2.2: WRITE OPERATIONS (ACTIONS)

// Process approval or rejection action
// POST /api/inspection-approval/action
// Body: { action: 'APPROVE'|'REJECT', wfaiisd_id: '...', comments: '...' }
router.post('/action', controller.processApprovalAction);

module.exports = router;
