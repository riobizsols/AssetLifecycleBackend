const express = require('express');
const router = express.Router();
const CronController = require('../services/cronController');

const cronController = new CronController();

// Manual trigger endpoint for maintenance generation (for testing)
router.post('/trigger-maintenance', cronController.triggerMaintenanceGeneration.bind(cronController));

// Manual trigger endpoint for vendor contract renewal (for testing)
router.post('/trigger-vendor-contract-renewal', cronController.triggerVendorContractRenewal.bind(cronController));

// Manual trigger endpoint for inspection generation (for testing)
router.post('/trigger-inspection', cronController.triggerInspection.bind(cronController));

// Get cron job status
router.get('/status', cronController.getCronStatus.bind(cronController));

module.exports = router; 