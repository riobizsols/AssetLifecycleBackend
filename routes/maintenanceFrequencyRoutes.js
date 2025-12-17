const express = require('express');
const router = express.Router();
const MaintenanceFrequencyController = require('../controllers/maintenanceFrequencyController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get all maintenance frequencies
router.get('/', MaintenanceFrequencyController.getAllMaintenanceFrequencies);

// Get maintenance frequencies by asset type
router.get('/asset-type/:assetTypeId', MaintenanceFrequencyController.getMaintenanceFrequenciesByAssetType);

// Get maintenance frequency by ID
router.get('/:id', MaintenanceFrequencyController.getMaintenanceFrequencyById);

// Create maintenance frequency
router.post('/', MaintenanceFrequencyController.createMaintenanceFrequency);

// Update maintenance frequency
router.put('/:id', MaintenanceFrequencyController.updateMaintenanceFrequency);

// Delete maintenance frequency
router.delete('/:id', MaintenanceFrequencyController.deleteMaintenanceFrequency);

// Get checklist items for a maintenance frequency
router.get('/:id/checklist', MaintenanceFrequencyController.getChecklistItems);

// Add checklist item to a maintenance frequency
router.post('/:id/checklist', MaintenanceFrequencyController.addChecklistItem);

// Delete checklist item
router.delete('/:id/checklist/:itemId', MaintenanceFrequencyController.deleteChecklistItem);

module.exports = router;

