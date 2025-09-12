const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
    addAssetType,
    getAllAssetTypes,
    getAssetTypeById,
    updateAssetType,
    deleteAssetType,
    getParentAssetTypes,
    getAssetTypesByAssignmentType,
    getAssetTypesByGroupRequired,
    getAllProperties,
    getAssetTypeProperties,
    mapAssetTypeProperties,
    deleteAssetTypeProperty
} = require('../controllers/assetTypeController');

// Apply authentication middleware to all routes
router.use(protect);

// Add new asset type
router.post('/', addAssetType);

// Get all asset types
router.get('/', getAllAssetTypes);

// Get all parent asset types
router.get('/parents', getParentAssetTypes);

// Get asset types by assignment type
router.get('/assignment-type/:assignment_type', getAssetTypesByAssignmentType);

// Get asset types where group_required is true
router.get('/group-required', getAssetTypesByGroupRequired);

// Get all properties
router.get('/properties', getAllProperties);

// Get properties for a specific asset type
router.get('/:id/properties', getAssetTypeProperties);

// Map properties to asset type
router.post('/:id/properties', mapAssetTypeProperties);

// Delete individual property mapping
router.delete('/properties/:assetTypePropId', deleteAssetTypeProperty);

// Get asset type by ID
router.get('/:id', getAssetTypeById);

// Update asset type
router.put('/:id', updateAssetType);

// Delete asset type
router.delete('/:id', deleteAssetType);

module.exports = router;