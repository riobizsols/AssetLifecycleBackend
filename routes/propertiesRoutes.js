const express = require('express');
const router = express.Router();
const PropertiesController = require('../controllers/propertiesController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get all properties
router.get('/', PropertiesController.getAllProperties); //..

// Create asset type with properties
router.post('/asset-types', PropertiesController.createAssetTypeWithProperties); //...

// Get all asset types
router.get('/asset-types', PropertiesController.getAllAssetTypes);

// Get properties for a specific asset type
router.get('/asset-types/:assetTypeId/properties', PropertiesController.getPropertiesByAssetType);

// Get values for a specific property
router.get('/properties/:propId/values', PropertiesController.getPropertyValues);

// Get all properties with their values for a specific asset type
router.get('/asset-types/:assetTypeId/properties-with-values', PropertiesController.getPropertiesWithValues);

// Add new property value
router.post('/property-values', PropertiesController.addPropertyValue);

module.exports = router; 