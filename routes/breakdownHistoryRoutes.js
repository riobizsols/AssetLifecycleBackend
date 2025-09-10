const express = require('express');
const router = express.Router();
const {
    getBreakdownHistory,
    getBreakdownHistoryByAsset,
    getBreakdownHistorySummary,
    getBreakdownFilterOptions,
    exportBreakdownHistory
} = require('../controllers/breakdownHistoryController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get breakdown history with filtering
router.get('/', getBreakdownHistory);

// Get breakdown history by asset ID
router.get('/asset/:assetId', getBreakdownHistoryByAsset);

// Get breakdown history summary
router.get('/summary', getBreakdownHistorySummary);

// Get available filter options
router.get('/filter-options', getBreakdownFilterOptions);

// Export breakdown history
router.post('/export', exportBreakdownHistory);

module.exports = router;
