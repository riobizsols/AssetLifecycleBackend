const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
    getAllWorkflowSteps,
    createWorkflowStep,
    updateWorkflowStep,
    deleteWorkflowStep,
    getWorkflowSequencesByAssetType,
    createWorkflowSequence,
    updateWorkflowSequence,
    deleteWorkflowSequence,
    getJobRolesByWorkflowStep,
    createWorkflowJobRole,
    updateWorkflowJobRole,
    deleteWorkflowJobRole
} = require('../controllers/maintenanceDetailsController');

// All routes require authentication
router.use(protect);

// Workflow Steps routes
router.get('/workflow-steps', getAllWorkflowSteps);
router.post('/workflow-steps', createWorkflowStep);
router.put('/workflow-steps/:id', updateWorkflowStep);
router.delete('/workflow-steps/:id', deleteWorkflowStep);

// Workflow Sequences routes
router.get('/workflow-sequences/:asset_type_id', getWorkflowSequencesByAssetType);
router.post('/workflow-sequences', createWorkflowSequence);
router.put('/workflow-sequences/:id', updateWorkflowSequence);
router.delete('/workflow-sequences/:id', deleteWorkflowSequence);

// Workflow Job Roles routes
router.get('/workflow-job-roles/:wf_steps_id', getJobRolesByWorkflowStep);
router.post('/workflow-job-roles', createWorkflowJobRole);
router.put('/workflow-job-roles/:id', updateWorkflowJobRole);
router.delete('/workflow-job-roles/:id', deleteWorkflowJobRole);

module.exports = router;

