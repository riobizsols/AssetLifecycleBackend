const express = require('express');
const router = express.Router();
const {
    getBreakdownHistory,
    getBreakdownById,
    getBreakdownHistoryByAsset,
    getBreakdownHistorySummary,
    getBreakdownFilterOptions,
    getBreakdownsReopenedMultiple,
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

// Get breakdowns reopened more than once (Reopen Details screen)
router.get('/reopened-multiple', getBreakdownsReopenedMultiple);

// Export breakdown history
router.post('/export', exportBreakdownHistory);

// Get single breakdown by ID (must be after other static routes to avoid matching :breakdownId)
router.get('/:breakdownId', getBreakdownById);

module.exports = router;
