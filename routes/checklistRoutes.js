const express = require('express');
const router = express.Router();
const { getChecklistByAssetType, getChecklistByAssetId } = require('../controllers/checklistController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get checklist by asset type ID
// GET /api/checklist/asset-type/:assetTypeId
router.get('/asset-type/:assetTypeId', getChecklistByAssetType);

// Get checklist by asset ID
// GET /api/checklist/asset/:assetId
router.get('/asset/:assetId', getChecklistByAssetId);

module.exports = router; 