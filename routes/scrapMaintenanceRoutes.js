const express = require('express');
const router = express.Router();
const controller = require('../controllers/scrapMaintenanceController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

// Create a scrap workflow request (asset or group)
router.post('/create', controller.createScrapRequest);

// Create a scrap workflow request by selecting some assets from an existing group (splits the group)
router.post('/create-from-group-selection', controller.createScrapRequestFromGroupSelection);

// List scrap approvals for current user (role-based)
router.get('/approvals', controller.getScrapMaintenanceApprovals);

// Get workflow detail
router.get('/workflow/:id', controller.getScrapApprovalDetail);

// Approve / Reject
router.post('/:id/approve', controller.approveScrap);
router.post('/:id/reject', controller.rejectScrap);

module.exports = router;

