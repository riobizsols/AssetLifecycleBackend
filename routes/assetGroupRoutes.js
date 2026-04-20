const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
    createAssetGroup,
    getAllAssetGroups,
    getAssetGroupsByAssetType,
    getAssetGroupById,
    updateAssetGroup,
    deleteAssetGroup
} = require('../controllers/assetGroupController');

// Apply protect middleware to all routes
router.use(protect);

// Create new asset group
router.post('/', createAssetGroup);

// Get all asset groups
router.get('/', getAllAssetGroups);

// Get asset groups by asset type (groups with only this asset type)
router.get('/by-asset-type/:asset_type_id', getAssetGroupsByAssetType);

// Get asset group by ID
router.get('/:id', getAssetGroupById);

// Update asset group
router.put('/:id', updateAssetGroup);

// Delete asset group
router.delete('/:id', deleteAssetGroup);

module.exports = router;
