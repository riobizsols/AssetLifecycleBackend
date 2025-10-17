const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  getOverdueWorkflowsController,
  triggerEscalationProcessController,
  getNextApproverController,
  manualEscalateWorkflowController
} = require('../controllers/workflowEscalationController');

// Get all overdue workflows
router.get('/overdue', protect, getOverdueWorkflowsController);

// Manually trigger escalation process
router.post('/process', protect, triggerEscalationProcessController);

// Get next approver for a workflow
router.get('/next-approver/:wfamshId', protect, getNextApproverController);

// Manually escalate a specific workflow
router.post('/escalate', protect, manualEscalateWorkflowController);

module.exports = router;

