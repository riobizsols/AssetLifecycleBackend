const express = require('express');
const router = express.Router();
const {
    generateMaintenanceSchedules,
    getMaintenanceSchedulesForAsset,
    getAssetTypesRequiringMaintenance,
    getMaintenanceFrequencyForAssetType,
    getAllMaintenanceSchedules,
    getMaintenanceScheduleById,
    updateMaintenanceSchedule
} = require('../controllers/maintenanceScheduleController');
const { protect } = require('../middlewares/authMiddleware');

// Generate maintenance schedules (protected for manual access)
router.post('/generate', protect, generateMaintenanceSchedules);

// Generate maintenance schedules (unprotected for cron jobs)
router.post('/generate-cron', generateMaintenanceSchedules);

// Get all maintenance schedules from tblAssetMaintSch (protected)
router.get('/all', protect, getAllMaintenanceSchedules);

// Get asset types requiring maintenance (protected)
router.get('/asset-types', protect, getAssetTypesRequiringMaintenance);

// Get maintenance frequency for asset type (protected)
router.get('/frequency/:asset_type_id', protect, getMaintenanceFrequencyForAssetType);

// Get maintenance schedules for specific asset (protected)
router.get('/asset/:asset_id', protect, getMaintenanceSchedulesForAsset);

// Update maintenance schedule by ID (protected)
router.put('/:id', protect, updateMaintenanceSchedule);

// Get maintenance schedule details by ID (protected) - This must be last
router.get('/:id', protect, getMaintenanceScheduleById);

module.exports = router; 