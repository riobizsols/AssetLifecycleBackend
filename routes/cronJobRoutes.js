const express = require('express');
const router = express.Router();
const CronJobController = require('../controllers/cronJobController');
const { protect } = require('../middlewares/authMiddleware');

// Trigger depreciation calculation cron job manually
router.post('/trigger-depreciation', protect, CronJobController.triggerDepreciationCronJob);

// One-time job: set default maintenance workflow sequence (tblWFATSeqs) for eligible asset types
router.post('/one-time/set-default-workflow-sequence', protect, CronJobController.triggerDefaultWorkflowSequenceBackfill);

// One-time job: set default scrap workflow sequence (tblWFScrapSeq) for eligible asset types
router.post('/one-time/set-default-scrap-workflow-sequence', protect, CronJobController.triggerDefaultScrapWorkflowSequenceBackfill);

// Get cron job status
router.get('/status/:org_id', protect, CronJobController.getCronJobStatus);

module.exports = router;
