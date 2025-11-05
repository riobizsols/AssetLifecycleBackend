const express = require('express');
const router = express.Router();
const controller = require('../controllers/backupController');
const { protect } = require('../middleware/authMiddleware'); // Adjust path as needed

// All backup routes require authentication
router.use(protect);

// Trigger manual backup
router.post('/trigger', controller.triggerBackup);

// Get backup status
router.get('/status', controller.getBackupStatus);

// List all backups
router.get('/list', controller.listBackups);

// Download backup file
router.get('/download/:filename', controller.downloadBackup);

// Delete backup file
router.delete('/:filename', controller.deleteBackup);

module.exports = router;
