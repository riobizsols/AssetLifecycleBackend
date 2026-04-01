const express = require('express');
const router = express.Router();
const CronJobController = require('../controllers/cronJobController');
const { protect } = require('../middlewares/authMiddleware');

// Trigger depreciation calculation cron job manually
router.post('/trigger-depreciation', protect, CronJobController.triggerDepreciationCronJob);

// One-time job: set default workflow sequence for eligible asset types
router.post('/one-time/set-default-workflow-sequence', protect, CronJobController.triggerDefaultWorkflowSequenceBackfill);

// Get cron job status
router.get('/status/:org_id', protect, CronJobController.getCronJobStatus);

module.exports = router;
