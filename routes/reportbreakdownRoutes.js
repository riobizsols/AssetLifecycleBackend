const express = require('express');
const router = express.Router();
const { getReasonCodes, getAllReports, getUpcomingMaintenanceDate, createBreakdownReport, updateBreakdownReport } = require('../controllers/reportbreakdownController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/reason-codes', protect, getReasonCodes);
router.get('/reports', protect, getAllReports);
router.get('/upcoming-maintenance/:assetId', protect, getUpcomingMaintenanceDate);
router.post('/create', protect, createBreakdownReport);
router.put('/update/:id', protect, updateBreakdownReport);

module.exports = router;


