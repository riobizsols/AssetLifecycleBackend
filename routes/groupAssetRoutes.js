const express = require('express');
const router = express.Router();
const {
    getAvailableAssetsByAssetType,
    getAllAvailableAssets,
    getAvailableAssetsWithFilters,
    getAvailableAssetsCount,
    checkAssetAvailability,
    getAvailableAssetsByAssetTypeDetailed
} = require('../controllers/groupAssetController');

// GET /api/group-assets/available - Get all available assets
router.get('/available', getAllAvailableAssets);

// GET /api/group-assets/available/:asset_type_id - Get available assets by asset type
router.get('/available/:asset_type_id', getAvailableAssetsByAssetType);

// GET /api/group-assets/available-by-type/:asset_type_id - Get available assets by asset type (detailed)
router.get('/available-by-type/:asset_type_id', getAvailableAssetsByAssetTypeDetailed);

// GET /api/group-assets/available/:asset_type_id/filtered - Get available assets with filters
router.get('/available/:asset_type_id/filtered', getAvailableAssetsWithFilters);

// GET /api/group-assets/available/:asset_type_id/count - Get count of available assets
router.get('/available/:asset_type_id/count', getAvailableAssetsCount);

// GET /api/group-assets/check/:asset_id - Check if asset is available for grouping
router.get('/check/:asset_id', checkAssetAvailability);

module.exports = router;
