const express = require('express');
const router = express.Router();
const fcmController = require('../controllers/fcmController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

/**
 * @route POST /api/fcm/register-token
 * @desc Register device token for push notifications
 * @access Private
 */
router.post('/register-token', fcmController.registerDeviceToken);

/**
 * @route POST /api/fcm/unregister-token
 * @desc Unregister device token
 * @access Private
 */
router.post('/unregister-token', fcmController.unregisterDeviceToken);

/**
 * @route GET /api/fcm/device-tokens
 * @desc Get user's device tokens
 * @access Private
 */
router.get('/device-tokens', fcmController.getUserDeviceTokens);

/**
 * @route PUT /api/fcm/preferences
 * @desc Update notification preferences
 * @access Private
 */
router.put('/preferences', fcmController.updateNotificationPreferences);

/**
 * @route GET /api/fcm/preferences
 * @desc Get notification preferences
 * @access Private
 */
router.get('/preferences', fcmController.getNotificationPreferences);

/**
 * @route GET /api/fcm/history
 * @desc Get FCM notification history for current user
 * @access Private
 */
router.get('/history', fcmController.getNotificationHistory);

/**
 * @route POST /api/fcm/test-notification
 * @desc Send test notification to current user
 * @access Private
 */
router.post('/test-notification', fcmController.sendTestNotification);

module.exports = router;
