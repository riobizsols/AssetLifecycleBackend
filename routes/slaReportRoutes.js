const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const slaReportController = require('../controllers/slaReportController');

// All routes require authentication
router.use(protect);

// GET /api/sla-report - Get SLA report data with filters
router.get('/', slaReportController.getSLAReport);

// GET /api/sla-report/filter-options - Get filter options (vendors, asset types, assets)
router.get('/filter-options', slaReportController.getSLAReportFilterOptions);

module.exports = router;


