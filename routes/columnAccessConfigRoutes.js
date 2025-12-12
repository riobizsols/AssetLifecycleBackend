const express = require('express');
const router = express.Router();
const columnAccessConfigController = require('../controllers/columnAccessConfigController');
const { protect } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(protect);

// Get table columns dynamically
router.get('/table-columns/:tableName', columnAccessConfigController.getTableColumns);

// Get all column access configurations
router.get('/', columnAccessConfigController.getAllColumnAccessConfigs);

// Get column access configuration by ID
router.get('/:id', columnAccessConfigController.getColumnAccessConfigById);

// Create or update column access configuration
router.post('/', columnAccessConfigController.upsertColumnAccessConfig);

// Bulk upsert column access configurations
router.post('/bulk', columnAccessConfigController.bulkUpsertColumnAccessConfigs);

// Delete column access configuration
router.delete('/:id', columnAccessConfigController.deleteColumnAccessConfig);

// Get column access for a specific job role and table
router.get('/:jobRoleId/:tableName', columnAccessConfigController.getColumnAccessForJobRoleAndTable);

module.exports = router;

