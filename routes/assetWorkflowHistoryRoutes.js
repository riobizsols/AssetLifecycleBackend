const express = require('express');
const router = express.Router();
const {
    getAssetWorkflowHistory,
    getAssetWorkflowHistoryByAsset,
    getWorkflowHistoryDetails,
    getAssetWorkflowHistorySummary,
    getWorkflowFilterOptions,
    exportAssetWorkflowHistory
} = require('../controllers/assetWorkflowHistoryController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get asset workflow history with filtering
router.get('/', getAssetWorkflowHistory);

// Get asset workflow history by asset ID
router.get('/asset/:assetId', getAssetWorkflowHistoryByAsset);

// Get workflow history details for a specific workflow
router.get('/workflow/:workflowId', getWorkflowHistoryDetails);

// Get asset workflow history summary
router.get('/summary', getAssetWorkflowHistorySummary);

// Get available filter options
router.get('/filter-options', getWorkflowFilterOptions);

// Export asset workflow history
router.post('/export', exportAssetWorkflowHistory);

module.exports = router;
