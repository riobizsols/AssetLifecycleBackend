const express = require('express');
const router = express.Router();
const {
    createAssetGroup,
    getAllAssetGroups,
    getAssetGroupById,
    updateAssetGroup,
    deleteAssetGroup
} = require('../controllers/assetGroupController');

// Create new asset group
router.post('/', createAssetGroup);

// Get all asset groups
router.get('/', getAllAssetGroups);

// Get asset group by ID
router.get('/:id', getAssetGroupById);

// Update asset group
router.put('/:id', updateAssetGroup);

// Delete asset group
router.delete('/:id', deleteAssetGroup);

module.exports = router;
