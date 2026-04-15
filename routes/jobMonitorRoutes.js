const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const {
  getJobs,
  updateJobConfig,
  runJob,
  getHistory,
  cleanupWarrantyNotifications,
} = require('../controllers/jobMonitorController');

const router = express.Router();

router.get('/jobs', protect, getJobs);
router.put('/jobs/:jobId', protect, updateJobConfig);
router.post('/jobs/:jobId/run', protect, runJob);
router.get('/jobs/:jobId/history', protect, getHistory);
router.post('/warranty-notifications/cleanup', protect, cleanupWarrantyNotifications);

module.exports = router;

