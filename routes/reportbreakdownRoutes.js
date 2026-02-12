const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const { getReasonCodes, getAllReports, getUpcomingMaintenanceDate, createBreakdownReport, updateBreakdownReport, confirmEmployeeReportBreakdown, reopenEmployeeReportBreakdown } = require('../controllers/reportbreakdownController');
=======
const { getReasonCodes, getAllReports, getUpcomingMaintenanceDate, createBreakdownReport, updateBreakdownReport, deleteBreakdownReport } = require('../controllers/reportbreakdownController');
>>>>>>> origin/akash
const { protect } = require('../middlewares/authMiddleware');

router.get('/reason-codes', protect, getReasonCodes);
router.get('/reports', protect, getAllReports);
router.get('/upcoming-maintenance/:assetId', protect, getUpcomingMaintenanceDate);
router.post('/create', protect, createBreakdownReport);
router.put('/update/:id', protect, updateBreakdownReport);
router.delete('/:id', protect, deleteBreakdownReport);

// Employee Confirm/Reopen endpoints
router.post('/:id/confirm', protect, confirmEmployeeReportBreakdown);
router.post('/:id/reopen', protect, reopenEmployeeReportBreakdown);

module.exports = router;


