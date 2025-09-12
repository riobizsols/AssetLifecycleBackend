const express = require('express');
const router = express.Router();
const AppEventsController = require('../controllers/appEventsController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

/**
 * @route GET /api/app-events/enabled/:appId
 * @description Get enabled events for a specific app
 * @param {string} appId - The app ID from tblApps table
 * @returns {Object} Response with enabled events for the app
 */
router.get('/enabled/:appId', AppEventsController.getEnabledEventsForApp);

/**
 * @route GET /api/app-events/all/:appId
 * @description Get all events for a specific app (both enabled and disabled)
 * @param {string} appId - The app ID from tblApps table
 * @returns {Object} Response with all events for the app
 */
router.get('/all/:appId', AppEventsController.getAllEventsForApp);

/**
 * @route GET /api/app-events/apps
 * @description Get all available apps
 * @returns {Object} Response with all available apps
 */
router.get('/apps', AppEventsController.getAllApps);

/**
 * @route GET /api/app-events/events
 * @description Get all available events
 * @returns {Object} Response with all available events
 */
router.get('/events', AppEventsController.getAllEvents);

module.exports = router;
