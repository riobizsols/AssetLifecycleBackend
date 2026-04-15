const express = require('express');
const router = express.Router();
const { 
  getAllNotifications, 
  getUserNotifications, 
  getNotificationStatistics, 
  getFilteredNotifications,
  openWarrantyNotification,
  discardWarrantyNotificationAction,
  snoozeWarrantyNotificationAction,
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get all maintenance notifications for organization
// GET /api/notifications
router.get('/', getAllNotifications); //tested

// Get maintenance notifications for a specific user
// GET /api/notifications/user/:userId
router.get('/user/:userId', getUserNotifications); //tested

// Get notification statistics
// GET /api/notifications/stats
router.get('/stats', getNotificationStatistics);

// Get filtered notifications
// GET /api/notifications/filtered?status=IN&urgency=urgent&assetType=laptop
router.get('/filtered', getFilteredNotifications);

router.put('/warranty/:notifyId/open', openWarrantyNotification);
router.put('/warranty/:notifyId/discard', discardWarrantyNotificationAction);
router.put('/warranty/:notifyId/snooze', snoozeWarrantyNotificationAction);


module.exports = router;