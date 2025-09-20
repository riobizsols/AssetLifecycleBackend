const express = require('express');
const router = express.Router();
const AuditLogConfigController = require('../controllers/auditLogConfigController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get all audit log configurations
router.get('/', AuditLogConfigController.getAll);

// Get audit log configuration by ID
router.get('/:alcId', AuditLogConfigController.getById);

// Update audit log configuration
router.put('/:alcId', AuditLogConfigController.update);

// Get configurations by app ID
router.get('/app/:appId', AuditLogConfigController.getByAppId);

module.exports = router;
