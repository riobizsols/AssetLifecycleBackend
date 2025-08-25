const express = require('express');
const router = express.Router();
const { getReasonCodes, getAllReports, getUpcomingMaintenanceDate, createBreakdownReport } = require('../controllers/reportbreakdownController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/reason-codes', protect, getReasonCodes);
router.get('/reports', protect, getAllReports);
router.get('/upcoming-maintenance/:assetId', protect, getUpcomingMaintenanceDate);
router.post('/create', protect, createBreakdownReport);

module.exports = router;


