const eventLogger = require('../services/eventLogger');
const APP_ID = 'MAINTENANCECRON'; // Dedicated app_id for maintenance cron jobs

/**
 * Maintenance Cron Event Logger
 * Comprehensive logging for all maintenance cron job operations
 * Uses dedicated MAINTENANCECRON app_id for separate CSV file
 */

// ===== GENERAL LOGGING FUNCTIONS =====

async function logApiCall(options) {
    const { appId = APP_ID, eventType, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId,
        logLevel: 'INFO',
        eventType,
        module: 'MaintenanceCronService',
        message: `INFO: ${eventType} API called`,
        requestData,
        userId,
        duration
    });
}

async function logOperationSuccess(options) {
    const { appId = APP_ID, eventType, requestData, responseData, userId, duration } = options;
    await eventLogger.logEvent({
        appId,
        logLevel: 'INFO',
        eventType,
        module: 'MaintenanceCronService',
        message: `INFO: ${eventType} completed successfully`,
        requestData,
        responseData,
        userId,
        duration
    });
}

async function logOperationError(options) {
    const { appId = APP_ID, eventType, requestData, error, userId, duration } = options;
    await eventLogger.logEvent({
        appId,
        logLevel: 'ERROR',
        eventType,
        module: 'MaintenanceCronService',
        message: `ERROR: ${eventType} failed`,
        requestData,
        responseData: { error: error.message || error },
        userId,
        duration
    });
}

// ===== WORKFLOW ESCALATION CRON OPERATIONS =====

async function logWorkflowEscalationCronStarted(options) {
    const { schedule, timezone, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'WORKFLOW_ESCALATION_CRON_STARTED',
        module: 'MaintenanceCronService',
        message: 'INFO: Workflow escalation cron job started',
        requestData: { schedule, timezone, operation: 'start_workflow_escalation_cron' },
        userId
    });
}

async function logWorkflowEscalationCronExecutionStarted(options) {
    const { executionTime, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'WORKFLOW_ESCALATION_CRON_EXECUTION_STARTED',
        module: 'MaintenanceCronService',
        message: 'INFO: Workflow escalation cron execution started',
        requestData: { executionTime, operation: 'execute_workflow_escalation' },
        userId
    });
}

async function logProcessingWorkflowEscalations(options) {
    const { orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'PROCESSING_WORKFLOW_ESCALATIONS',
        module: 'MaintenanceCronService',
        message: 'INFO: Processing workflow escalations',
        requestData: { orgId, operation: 'process_workflow_escalations' },
        userId
    });
}

async function logWorkflowEscalationCronCompleted(options) {
    const { orgId, results, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'WORKFLOW_ESCALATION_CRON_COMPLETED',
        module: 'MaintenanceCronService',
        message: 'INFO: Workflow escalation cron execution completed successfully',
        requestData: { orgId, results },
        responseData: results,
        userId,
        duration
    });
}

async function logWorkflowEscalationCronError(options) {
    const { orgId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'WORKFLOW_ESCALATION_CRON_ERROR',
        module: 'MaintenanceCronService',
        message: 'ERROR: Workflow escalation cron execution failed',
        requestData: { orgId, error: error.message || error },
        userId
    });
}

async function logWorkflowEscalationCronStopped(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'WORKFLOW_ESCALATION_CRON_STOPPED',
        module: 'MaintenanceCronService',
        message: 'INFO: Workflow escalation cron job stopped',
        requestData: { operation: 'stop_workflow_escalation_cron' },
        userId
    });
}

// ===== MAINTENANCE SCHEDULE GENERATION CRON OPERATIONS =====

async function logMaintenanceScheduleCronStarted(options) {
    const { schedule, timezone, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MAINTENANCE_SCHEDULE_CRON_STARTED',
        module: 'MaintenanceCronService',
        message: 'INFO: Maintenance schedule generation cron job started',
        requestData: { schedule, timezone, operation: 'start_maintenance_schedule_cron' },
        userId
    });
}

async function logMaintenanceScheduleCronExecutionStarted(options) {
    const { executionTime, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MAINTENANCE_SCHEDULE_CRON_EXECUTION_STARTED',
        module: 'MaintenanceCronService',
        message: 'INFO: Maintenance schedule generation cron execution started',
        requestData: { executionTime, operation: 'execute_maintenance_schedule_generation' },
        userId
    });
}

async function logCallingMaintenanceScheduleAPI(options) {
    const { url, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CALLING_MAINTENANCE_SCHEDULE_API',
        module: 'MaintenanceCronService',
        message: 'INFO: Calling maintenance schedule generation API',
        requestData: { url, operation: 'call_maintenance_schedule_api' },
        userId
    });
}

async function logMaintenanceScheduleAPIResponse(options) {
    const { status, data, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MAINTENANCE_SCHEDULE_API_RESPONSE',
        module: 'MaintenanceCronService',
        message: 'INFO: Maintenance schedule API response received',
        requestData: { status, data },
        userId
    });
}

async function logMaintenanceScheduleCronCompleted(options) {
    const { results, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MAINTENANCE_SCHEDULE_CRON_COMPLETED',
        module: 'MaintenanceCronService',
        message: 'INFO: Maintenance schedule generation cron execution completed successfully',
        requestData: { results },
        responseData: results,
        userId,
        duration
    });
}

async function logMaintenanceScheduleCronError(options) {
    const { error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'MAINTENANCE_SCHEDULE_CRON_ERROR',
        module: 'MaintenanceCronService',
        message: 'ERROR: Maintenance schedule generation cron execution failed',
        requestData: { error: error.message || error },
        userId
    });
}

async function logMaintenanceScheduleAPIError(options) {
    const { error, status, data, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'MAINTENANCE_SCHEDULE_API_ERROR',
        module: 'MaintenanceCronService',
        message: 'ERROR: Maintenance schedule API call failed',
        requestData: { error: error.message || error, status, data },
        userId
    });
}

// ===== MANUAL TRIGGER OPERATIONS =====

async function logManualTriggerMaintenanceGeneration(options) {
    const { triggeredBy, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MANUAL_TRIGGER_MAINTENANCE_GENERATION',
        module: 'MaintenanceCronService',
        message: 'INFO: Manual maintenance generation triggered',
        requestData: { triggeredBy, operation: 'manual_trigger_maintenance_generation' },
        userId
    });
}

async function logManualTriggerWorkflowEscalation(options) {
    const { triggeredBy, orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MANUAL_TRIGGER_WORKFLOW_ESCALATION',
        module: 'MaintenanceCronService',
        message: 'INFO: Manual workflow escalation triggered',
        requestData: { triggeredBy, orgId, operation: 'manual_trigger_workflow_escalation' },
        userId
    });
}

// ===== CRON JOB STATUS OPERATIONS =====

async function logCronJobStatusRequested(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CRON_JOB_STATUS_REQUESTED',
        module: 'MaintenanceCronService',
        message: 'INFO: Cron job status requested',
        requestData: { operation: 'get_cron_job_status' },
        userId
    });
}

async function logCronJobStatusRetrieved(options) {
    const { status, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CRON_JOB_STATUS_RETRIEVED',
        module: 'MaintenanceCronService',
        message: 'INFO: Cron job status retrieved successfully',
        requestData: { status },
        userId
    });
}

// ===== SYSTEM OPERATIONS =====

async function logCronJobInitialization(options) {
    const { jobs, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CRON_JOB_INITIALIZATION',
        module: 'MaintenanceCronService',
        message: 'INFO: Cron jobs initialized',
        requestData: { jobs, operation: 'initialize_cron_jobs' },
        userId
    });
}

async function logCronJobInitializationError(options) {
    const { error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'CRON_JOB_INITIALIZATION_ERROR',
        module: 'MaintenanceCronService',
        message: 'ERROR: Cron job initialization failed',
        requestData: { error: error.message || error },
        userId
    });
}

async function logCronJobScheduling(options) {
    const { jobName, schedule, timezone, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CRON_JOB_SCHEDULING',
        module: 'MaintenanceCronService',
        message: 'INFO: Cron job scheduled',
        requestData: { jobName, schedule, timezone, operation: 'schedule_cron_job' },
        userId
    });
}

async function logCronJobSchedulingError(options) {
    const { jobName, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'CRON_JOB_SCHEDULING_ERROR',
        module: 'MaintenanceCronService',
        message: 'ERROR: Cron job scheduling failed',
        requestData: { jobName, error: error.message || error },
        userId
    });
}

// ===== DATABASE OPERATIONS =====

async function logDatabaseTransactionStarted(options) {
    const { operation, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DATABASE_TRANSACTION_STARTED',
        module: 'MaintenanceCronService',
        message: 'INFO: Database transaction started',
        requestData: { operation, message: 'Starting database transaction' },
        userId
    });
}

async function logDatabaseTransactionCompleted(options) {
    const { operation, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DATABASE_TRANSACTION_COMPLETED',
        module: 'MaintenanceCronService',
        message: 'INFO: Database transaction completed',
        requestData: { operation, message: 'Database transaction completed successfully' },
        userId
    });
}

async function logDatabaseTransactionRollback(options) {
    const { operation, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DATABASE_TRANSACTION_ROLLBACK',
        module: 'MaintenanceCronService',
        message: 'ERROR: Database transaction rolled back',
        requestData: { operation, error: error.message || error },
        userId
    });
}

// ===== EMAIL NOTIFICATIONS =====

async function logEmailNotificationSent(options) {
    const { recipient, subject, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'EMAIL_NOTIFICATION_SENT',
        module: 'MaintenanceCronService',
        message: 'INFO: Email notification sent',
        requestData: { recipient, subject, message: 'Escalation notification sent' },
        userId
    });
}

async function logEmailNotificationError(options) {
    const { recipient, subject, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'EMAIL_NOTIFICATION_ERROR',
        module: 'MaintenanceCronService',
        message: 'ERROR: Failed to send email notification',
        requestData: { recipient, subject, error: error.message || error },
        userId
    });
}

// ===== DATABASE ERROR HANDLING =====

async function logDatabaseConnectionFailure(options) {
    const { operation, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'CRITICAL',
        eventType: 'DATABASE_CONNECTION_FAILURE',
        module: 'MaintenanceCronService',
        message: 'CRITICAL: Database connection failure',
        requestData: { operation, error: error.message || error },
        userId
    });
}

async function logDatabaseConstraintViolation(options) {
    const { operation, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DATABASE_CONSTRAINT_VIOLATION',
        module: 'MaintenanceCronService',
        message: 'ERROR: Database constraint violation',
        requestData: { operation, error: error.message || error },
        userId
    });
}

async function logDataRetrievalError(options) {
    const { operation, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DATA_RETRIEVAL_ERROR',
        module: 'MaintenanceCronService',
        message: 'ERROR: Data retrieval error',
        requestData: { operation, error: error.message || error },
        userId
    });
}

module.exports = {
    // General logging
    logApiCall,
    logOperationSuccess,
    logOperationError,
    
    // Workflow escalation cron operations
    logWorkflowEscalationCronStarted,
    logWorkflowEscalationCronExecutionStarted,
    logProcessingWorkflowEscalations,
    logWorkflowEscalationCronCompleted,
    logWorkflowEscalationCronError,
    logWorkflowEscalationCronStopped,
    
    // Maintenance schedule generation cron operations
    logMaintenanceScheduleCronStarted,
    logMaintenanceScheduleCronExecutionStarted,
    logCallingMaintenanceScheduleAPI,
    logMaintenanceScheduleAPIResponse,
    logMaintenanceScheduleCronCompleted,
    logMaintenanceScheduleCronError,
    logMaintenanceScheduleAPIError,
    
    // Manual trigger operations
    logManualTriggerMaintenanceGeneration,
    logManualTriggerWorkflowEscalation,
    
    // Cron job status operations
    logCronJobStatusRequested,
    logCronJobStatusRetrieved,
    
    // System operations
    logCronJobInitialization,
    logCronJobInitializationError,
    logCronJobScheduling,
    logCronJobSchedulingError,
    
    // Database operations
    logDatabaseTransactionStarted,
    logDatabaseTransactionCompleted,
    logDatabaseTransactionRollback,
    
    // Email notifications
    logEmailNotificationSent,
    logEmailNotificationError,
    
    // Database error handling
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation,
    logDataRetrievalError
};
