const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const workforceReportController = require('../controllers/workforceReportController');

router.use(protect);

router.get('/view', workforceReportController.viewWorkforceReport);
router.post('/view', workforceReportController.viewWorkforceReport);
router.get('/technician-detail', workforceReportController.getTechnicianDetail);
router.post('/technician-detail', workforceReportController.getTechnicianDetail);

module.exports = router;
