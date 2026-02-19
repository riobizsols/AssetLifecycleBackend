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
    getAssetTypesByMaintRequired,
    getAllProperties,
    getAssetTypeProperties,
    mapAssetTypeProperties,
    deleteAssetTypeProperty,
    trialBulkUpload,
    commitBulkUpload
} = require('../controllers/assetTypeController');

const techCertController = require('../controllers/techCertController');

// Apply authentication middleware to all routes
router.use(protect);

router.use((req, res, next) => {
    console.log(`[AssetTypeRoute] Incoming request: ${req.method} ${req.url}`);
    next();
});

// Tech mapping for Asset Types
router.get('/:assetTypeId/maintenance-certificates', techCertController.getMappedCertificates);
router.post('/:assetTypeId/maintenance-certificates', techCertController.saveMappedCertificates);

// Inspection Certificates Routes (Move specific static routes before generic :id)
router.get('/inspection-certificates', techCertController.getAllInspectionCertificates);
router.get('/:assetTypeId/inspection-certificates', techCertController.getInspectionCertificates);
router.post('/:assetTypeId/inspection-certificates', techCertController.saveInspectionCertificates);
router.delete('/inspection-certificates/:id', techCertController.deleteInspectionCertificate);

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

// Get asset types where maint_required is true
router.get('/maint-required', getAssetTypesByMaintRequired);

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

// Bulk upload endpoints
router.post('/trial-upload', trialBulkUpload);
router.post('/commit-bulk-upload', commitBulkUpload);

module.exports = router;