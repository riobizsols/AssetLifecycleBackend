const express = require('express');
const router = express.Router();
const {
    getMaintenanceHistory,
    getMaintenanceHistoryByAsset,
    getMaintenanceHistoryByWorkOrder,
    getMaintenanceHistorySummary,
    getFilterOptions,
    exportMaintenanceHistory
} = require('../controllers/maintenanceHistoryController');
const { protect } = require('../middlewares/authMiddleware');

// Get maintenance history with filtering (protected)
router.get('/', protect, getMaintenanceHistory);

// Get maintenance history by asset ID (protected)
router.get('/asset/:assetId', protect, getMaintenanceHistoryByAsset);

// Get maintenance history by work order ID (protected)
router.get('/work-order/:woId', protect, getMaintenanceHistoryByWorkOrder);

// Get maintenance history summary statistics (protected)
router.get('/summary', protect, getMaintenanceHistorySummary);

// Get filter options for dropdowns (protected)
router.get('/filter-options', protect, getFilterOptions);

// Export maintenance history to Excel (protected)
router.post('/export', protect, exportMaintenanceHistory);

module.exports = router;
