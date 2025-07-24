const express = require('express');
const router = express.Router();
const {
    addAssetType,
    getAllAssetTypes,
    getAssetTypeById,
    updateAssetType,
    deleteAssetType,
    getParentAssetTypes
} = require('../controllers/assetTypeController');

// Add new asset type
router.post('/', addAssetType);

// Get all asset types
router.get('/', getAllAssetTypes);

// Get all parent asset types
router.get('/parents', getParentAssetTypes);

// Get asset type by ID
router.get('/:id', getAssetTypeById);

// Update asset type
router.put('/:id', updateAssetType);

// Delete asset type
router.delete('/:id', deleteAssetType);

module.exports = router;