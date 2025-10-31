/**
 * Event Logger for FCM Push Notifications
 * 
 * This module handles event logging for all FCM-related operations.
 * Logs to: events_FCM_YYYY-MM-DD.csv
 * 
 * Log Levels:
 * - INFO: Normal operations (token registration, successful notifications)
 * - WARNING: Invalid tokens, disabled notifications, retry attempts
 * - ERROR: Notification sending failures, database errors
 * - CRITICAL: FCM service initialization failures, authentication errors
 */

const eventLogger = require('../services/eventLogger');

// ==================== GENERIC LOGGING HELPERS ====================

/**
 * Generic FCM operation logger (INFO)
 */
async function logFcmOperation(options) {
    const { operation, requestData, responseData, duration, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'FCM',
        eventType: 'FCM_OPERATION',
        module: 'FCMService',
        message: `INFO: ${operation}`,
        logLevel: 'INFO',
        requestData,
        responseData,
        duration,
        userId
    });
}

/**
 * Generic FCM operation success (INFO)
 */
async function logFcmOperationSuccess(options) {
    const { operation, requestData, responseData, duration, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'FCM',
        eventType: 'FCM_SUCCESS',
        module: 'FCMService',
        message: `INFO: ${operation} completed successfully`,
        logLevel: 'INFO',
        requestData,
        responseData,
        duration,
        userId
    });
}

/**
 * Generic FCM operation error (ERROR)
 */
async function logFcmOperationError(options) {
    const { operation, error, requestData, duration, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'FCM',
        eventType: 'FCM_ERROR',
        module: 'FCMService',
        message: `ERROR: ${operation} failed - ${error.message || error}`,
        logLevel: 'ERROR',
        requestData,
        responseData: { error: error.message || error },
        duration,
        userId
    });
}

// ==================== TOKEN MANAGEMENT EVENTS ====================

/**
 * Log device token registration (INFO)
 */
async function logDeviceTokenRegistered(options) {
    const { userId, deviceToken, deviceType, platform, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'Device Token Registration',
        requestData: { userId, deviceType, platform },
        responseData: { deviceToken: deviceToken.substring(0, 20) + '...' },
        duration,
        userId
    });
}

/**
 * Log device token update (INFO)
 */
async function logDeviceTokenUpdated(options) {
    const { userId, deviceToken, deviceType, platform, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'Device Token Update',
        requestData: { userId, deviceType, platform },
        responseData: { deviceToken: deviceToken.substring(0, 20) + '...' },
        duration,
        userId
    });
}

/**
 * Log device token unregistration (INFO)
 */
async function logDeviceTokenUnregistered(options) {
    const { userId, deviceToken, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'Device Token Unregistration',
        requestData: { userId },
        responseData: { deviceToken: deviceToken.substring(0, 20) + '...' },
        duration,
        userId
    });
}

/**
 * Log invalid token detection (WARNING)
 */
async function logInvalidTokenDetected(options) {
    const { tokenId, error, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'FCM',
        eventType: 'FCM_WARNING',
        module: 'FCMService',
        message: `WARNING: Invalid token detected - ${error}`,
        logLevel: 'WARNING',
        requestData: { tokenId },
        responseData: { error },
        duration,
        userId: null
    });
}

// ==================== NOTIFICATION SENDING EVENTS ====================

/**
 * Log notification sent successfully (INFO)
 */
async function logNotificationSent(options) {
    const { userId, title, notificationType, successCount, totalTokens, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'Push Notification Sent',
        requestData: { userId, notificationType, title },
        responseData: { successCount, totalTokens, successRate: `${Math.round((successCount/totalTokens)*100)}%` },
        duration,
        userId
    });
}

/**
 * Log notification sent to role (INFO)
 */
async function logNotificationSentToRole(options) {
    const { jobRoleId, title, notificationType, totalUsers, successCount, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'Push Notification Sent to Role',
        requestData: { jobRoleId, notificationType, title },
        responseData: { totalUsers, successCount, successRate: `${Math.round((successCount/totalUsers)*100)}%` },
        duration,
        userId: null
    });
}

/**
 * Log notification sending failure (ERROR)
 */
async function logNotificationSendFailure(options) {
    const { userId, title, notificationType, error, duration } = options;
    
    await logFcmOperationError({
        operation: 'Push Notification Send Failure',
        error,
        requestData: { userId, notificationType, title },
        duration,
        userId
    });
}

/**
 * Log notification disabled (WARNING)
 */
async function logNotificationDisabled(options) {
    const { userId, notificationType, reason, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'FCM',
        eventType: 'FCM_WARNING',
        module: 'FCMService',
        message: `WARNING: Notification disabled - ${reason}`,
        logLevel: 'WARNING',
        requestData: { userId, notificationType },
        responseData: { reason },
        duration,
        userId
    });
}

/**
 * Log no device tokens found (WARNING)
 */
async function logNoDeviceTokensFound(options) {
    const { userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'FCM',
        eventType: 'FCM_WARNING',
        module: 'FCMService',
        message: 'WARNING: No active device tokens found for user',
        logLevel: 'WARNING',
        requestData: { userId },
        responseData: { reason: 'No active tokens' },
        duration,
        userId
    });
}

// ==================== PREFERENCE MANAGEMENT EVENTS ====================

/**
 * Log notification preferences updated (INFO)
 */
async function logNotificationPreferencesUpdated(options) {
    const { userId, notificationType, preferences, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'Notification Preferences Updated',
        requestData: { userId, notificationType },
        responseData: preferences,
        duration,
        userId
    });
}

/**
 * Log notification preferences retrieved (INFO)
 */
async function logNotificationPreferencesRetrieved(options) {
    const { userId, preferencesCount, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'Notification Preferences Retrieved',
        requestData: { userId },
        responseData: { preferencesCount },
        duration,
        userId
    });
}

// ==================== SYSTEM EVENTS ====================

/**
 * Log FCM service initialization (INFO)
 */
async function logFcmServiceInitialized(options) {
    const { duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'FCM Service Initialization',
        requestData: {},
        responseData: { status: 'initialized' },
        duration,
        userId: null
    });
}

/**
 * Log FCM service initialization failure (CRITICAL)
 */
async function logFcmServiceInitializationFailure(options) {
    const { error, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'FCM',
        eventType: 'FCM_CRITICAL',
        module: 'FCMService',
        message: `CRITICAL: FCM Service initialization failed - ${error.message || error}`,
        logLevel: 'CRITICAL',
        requestData: {},
        responseData: { error: error.message || error },
        duration,
        userId: null
    });
}

/**
 * Log FCM authentication failure (CRITICAL)
 */
async function logFcmAuthenticationFailure(options) {
    const { error, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'FCM',
        eventType: 'FCM_CRITICAL',
        module: 'FCMService',
        message: `CRITICAL: FCM authentication failed - ${error.message || error}`,
        logLevel: 'CRITICAL',
        requestData: {},
        responseData: { error: error.message || error },
        duration,
        userId: null
    });
}

/**
 * Log database connection failure (CRITICAL)
 */
async function logFcmDatabaseConnectionFailure(options) {
    const { operation, error, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'FCM',
        eventType: 'FCM_CRITICAL',
        module: 'FCMService',
        message: `CRITICAL: Database connection failed during ${operation}`,
        logLevel: 'CRITICAL',
        requestData: { operation },
        responseData: { error: error.message || error },
        duration,
        userId: null
    });
}

// ==================== INTEGRATION EVENTS ====================

/**
 * Log FCM integration with asset events (INFO)
 */
async function logFcmAssetEventIntegration(options) {
    const { assetId, eventType, notificationSent, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'FCM Asset Event Integration',
        requestData: { assetId, eventType },
        responseData: { notificationSent },
        duration,
        userId: null
    });
}

/**
 * Log FCM integration with maintenance events (INFO)
 */
async function logFcmMaintenanceEventIntegration(options) {
    const { maintenanceId, eventType, notificationSent, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'FCM Maintenance Event Integration',
        requestData: { maintenanceId, eventType },
        responseData: { notificationSent },
        duration,
        userId: null
    });
}

/**
 * Log FCM integration with workflow events (INFO)
 */
async function logFcmWorkflowEventIntegration(options) {
    const { workflowId, eventType, notificationSent, duration } = options;
    
    await logFcmOperationSuccess({
        operation: 'FCM Workflow Event Integration',
        requestData: { workflowId, eventType },
        responseData: { notificationSent },
        duration,
        userId: null
    });
}

module.exports = {
    // Generic helpers
    logFcmOperation,
    logFcmOperationSuccess,
    logFcmOperationError,
    
    // Token management
    logDeviceTokenRegistered,
    logDeviceTokenUpdated,
    logDeviceTokenUnregistered,
    logInvalidTokenDetected,
    
    // Notification sending
    logNotificationSent,
    logNotificationSentToRole,
    logNotificationSendFailure,
    logNotificationDisabled,
    logNoDeviceTokensFound,
    
    // Preference management
    logNotificationPreferencesUpdated,
    logNotificationPreferencesRetrieved,
    
    // System events
    logFcmServiceInitialized,
    logFcmServiceInitializationFailure,
    logFcmAuthenticationFailure,
    logFcmDatabaseConnectionFailure,
    
    // Integration events
    logFcmAssetEventIntegration,
    logFcmMaintenanceEventIntegration,
    logFcmWorkflowEventIntegration
};
