const express = require('express');
const router = express.Router();
const CronJobController = require('../controllers/cronJobController');
const { protect } = require('../middlewares/authMiddleware');

// Trigger depreciation calculation cron job manually
router.post('/trigger-depreciation', protect, CronJobController.triggerDepreciationCronJob);

// Get cron job status
router.get('/status/:org_id', protect, CronJobController.getCronJobStatus);

module.exports = router;
