const express = require('express');
const router = express.Router();
const AuditLogController = require('../controllers/auditLogController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

/**
 * @route POST /api/audit-logs/record
 * @description Record a user action (only if the event is enabled for the app)
 * @param {string} app_id - The app ID where the action occurred
 * @param {string} event_id - The event ID that was triggered
 * @param {string} text - Description of the action
 * @returns {Object} Response indicating if the action was recorded
 * @example
 * POST /api/audit-logs/record
 * Body: {
 *   "app_id": "App005",
 *   "event_id": "Eve005",
 *   "text": "User created a new asset"
 * }
 * Response: {
 *   "success": true,
 *   "message": "User action recorded successfully",
 *   "data": {
 *     "audit_log": {
 *       "al_id": "uuid",
 *       "user_id": "USR001",
 *       "app_id": "App005",
 *       "event_id": "Eve005",
 *       "text": "User created a new asset",
 *       "created_on": "2025-01-11T09:30:00.000Z",
 *       "org_id": "ORG001"
 *     },
 *     "event_config": {
 *       "enabled": true,
 *       "reporting_required": true
 *     }
 *   }
 * }
 */
router.post('/record', AuditLogController.recordUserAction);

/**
 * @route GET /api/audit-logs/user
 * @description Get audit logs for the current user
 * @param {number} limit - Number of records to return (1-1000, default: 50)
 * @param {number} offset - Number of records to skip (default: 0)
 * @param {string} app_id - Filter by app ID
 * @param {string} event_id - Filter by event ID
 * @returns {Object} Response with user's audit logs
 * @example
 * GET /api/audit-logs/user?limit=20&offset=0&app_id=App005
 * Response: {
 *   "success": true,
 *   "message": "Found 15 audit log entries for user",
 *   "data": {
 *     "user_id": "USR001",
 *     "audit_logs": [
 *       {
 *         "al_id": "uuid",
 *         "user_id": "USR001",
 *         "app_id": "App005",
 *         "event_id": "Eve005",
 *         "text": "User created a new asset",
 *         "created_on": "2025-01-11T09:30:00.000Z",
 *         "org_id": "ORG001",
 *         "app_name": "Assets",
 *         "event_name": "Create"
 *       }
 *     ],
 *     "pagination": {
 *       "limit": 20,
 *       "offset": 0,
 *       "count": 15
 *     }
 *   }
 * }
 */
router.get('/user', AuditLogController.getUserAuditLogs);

/**
 * @route GET /api/audit-logs/app/:appId
 * @description Get audit logs for a specific app
 * @param {string} appId - The app ID
 * @param {number} limit - Number of records to return (1-1000, default: 50)
 * @param {number} offset - Number of records to skip (default: 0)
 * @param {string} user_id - Filter by user ID
 * @param {string} event_id - Filter by event ID
 * @returns {Object} Response with app's audit logs
 * @example
 * GET /api/audit-logs/app/App005?limit=10&user_id=USR001
 * Response: {
 *   "success": true,
 *   "message": "Found 8 audit log entries for app 'App005'",
 *   "data": {
 *     "app_id": "App005",
 *     "audit_logs": [...],
 *     "pagination": {
 *       "limit": 10,
 *       "offset": 0,
 *       "count": 8
 *     }
 *   }
 * }
 */
router.get('/app/:appId', AuditLogController.getAppAuditLogs);

/**
 * @route GET /api/audit-logs/stats
 * @description Get audit log statistics
 * @param {string} app_id - Filter by app ID
 * @param {string} user_id - Filter by user ID
 * @param {string} event_id - Filter by event ID
 * @param {string} date_from - Start date (YYYY-MM-DD)
 * @param {string} date_to - End date (YYYY-MM-DD)
 * @returns {Object} Response with audit log statistics
 * @example
 * GET /api/audit-logs/stats?app_id=App005&date_from=2025-01-01&date_to=2025-01-31
 * Response: {
 *   "success": true,
 *   "message": "Audit log statistics retrieved successfully",
 *   "data": {
 *     "statistics": {
 *       "total_actions": "150",
 *       "unique_users": "25",
 *       "unique_apps": "3",
 *       "unique_events": "8"
 *     },
 *     "filters": {
 *       "app_id": "App005",
 *       "date_from": "2025-01-01",
 *       "date_to": "2025-01-31"
 *     }
 *   }
 * }
 */
router.get('/stats', AuditLogController.getAuditLogStats);

/**
 * @route GET /api/audit-logs/check/:appId/:eventId
 * @description Check if an event is enabled for an app
 * @param {string} appId - The app ID
 * @param {string} eventId - The event ID
 * @returns {Object} Response indicating if the event is enabled
 * @example
 * GET /api/audit-logs/check/App005/Eve005
 * Response: {
 *   "success": true,
 *   "message": "Event 'Eve005' is enabled for app 'App005'",
 *   "data": {
 *     "enabled": true,
 *     "event_config": {
 *       "alc_id": "ALC001",
 *       "app_id": "App005",
 *       "event_id": "Eve005",
 *       "enabled": true,
 *       "reporting_required": true,
 *       "reporting_email": "admin@example.com"
 *     }
 *   }
 * }
 */
router.get('/check/:appId/:eventId', AuditLogController.checkEventEnabled);

    /**
 * @route GET /api/audit-logs
 * @description Get all audit logs with filtering options
 * @query {string} [app_id] - Filter by application ID
 * @query {string} [event_id] - Filter by event ID
 * @query {string} [user_id] - Filter by user ID
 * @query {string} [start_date] - Filter by start date (YYYY-MM-DD)
 * @query {string} [end_date] - Filter by end date (YYYY-MM-DD)
 * @query {number} [page=1] - Page number for pagination
 * @query {number} [limit=50] - Number of records per page
 * @returns {Object} Paginated audit logs with filtering
 * @example
 * GET /api/audit-logs?app_id=App005&start_date=2024-01-01&end_date=2024-01-31&page=1&limit=20
 * Response: {
 *   "success": true,
 *   "message": "Audit logs retrieved successfully",
 *   "data": {
 *     "audit_logs": [
 *       {
 *         "al_id": "AL001",
 *         "user_id": "USR001",
 *         "app_id": "App005",
 *         "event_id": "Eve005",
 *         "text": "User created a new asset",
 *         "created_on": "2024-01-15T10:30:00.000Z",
 *         "org_id": "ORG001"
 *       }
 *     ],
 *     "pagination": {
 *       "current_page": 1,
 *       "per_page": 20,
 *       "total_count": 150,
 *       "total_pages": 8
 *     }
 *   }
 * }
 */
router.get('/', AuditLogController.getAllAuditLogs);

module.exports = router;
