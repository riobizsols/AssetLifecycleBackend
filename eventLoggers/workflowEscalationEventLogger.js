const eventLogger = require('../services/eventLogger');
const APP_ID = 'MAINTENANCEAPPROVAL'; // Using maintenance approval app_id since workflow escalation is part of maintenance approval

/**
 * Workflow Escalation Event Logger
 * Comprehensive logging for all workflow escalation operations
 * Part of the maintenance approval system
 */

// ===== GENERAL LOGGING FUNCTIONS =====

async function logApiCall(options) {
    const { appId = APP_ID, eventType, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId,
        logLevel: 'INFO',
        eventType,
        module: 'WorkflowEscalationController',
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
        module: 'WorkflowEscalationController',
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
        module: 'WorkflowEscalationController',
        message: `ERROR: ${eventType} failed`,
        requestData,
        responseData: { error: error.message || error },
        userId,
        duration
    });
}

// ===== OVERDUE WORKFLOWS OPERATIONS =====

async function logGetOverdueWorkflowsApiCalled(options) {
    const { orgId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_OVERDUE_WORKFLOWS_API_CALLED',
        module: 'WorkflowEscalationController',
        message: 'INFO: Get overdue workflows API called',
        requestData: { orgId, ...requestData },
        userId,
        duration
    });
}

async function logQueryingOverdueWorkflows(options) {
    const { orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_OVERDUE_WORKFLOWS',
        module: 'WorkflowEscalationController',
        message: 'INFO: Querying overdue workflows from database',
        requestData: { orgId, operation: 'fetch_overdue_workflows' },
        userId
    });
}

async function logNoOverdueWorkflowsFound(options) {
    const { orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'NO_OVERDUE_WORKFLOWS_FOUND',
        module: 'WorkflowEscalationController',
        message: 'INFO: No overdue workflows found',
        requestData: { orgId, message: 'No overdue workflows found' },
        userId
    });
}

async function logOverdueWorkflowsRetrieved(options) {
    const { orgId, count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'OVERDUE_WORKFLOWS_RETRIEVED',
        module: 'WorkflowEscalationController',
        message: `INFO: Retrieved ${count} overdue workflows`,
        requestData: { orgId, count, message: `Retrieved ${count} overdue workflows` },
        userId
    });
}

async function logOverdueWorkflowsRetrievalError(options) {
    const { orgId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'OVERDUE_WORKFLOWS_RETRIEVAL_ERROR',
        module: 'WorkflowEscalationController',
        message: 'ERROR: Failed to retrieve overdue workflows',
        requestData: { orgId, error: error.message || error },
        userId
    });
}

// ===== ESCALATION PROCESS OPERATIONS =====

async function logTriggerEscalationProcessApiCalled(options) {
    const { orgId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'TRIGGER_ESCALATION_PROCESS_API_CALLED',
        module: 'WorkflowEscalationController',
        message: 'INFO: Trigger escalation process API called',
        requestData: { orgId, ...requestData },
        userId,
        duration
    });
}

async function logProcessingEscalationWorkflows(options) {
    const { orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'PROCESSING_ESCALATION_WORKFLOWS',
        module: 'WorkflowEscalationController',
        message: 'INFO: Processing workflow escalations',
        requestData: { orgId, operation: 'process_escalations' },
        userId
    });
}

async function logEscalationProcessCompleted(options) {
    const { orgId, results, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ESCALATION_PROCESS_COMPLETED',
        module: 'WorkflowEscalationController',
        message: 'INFO: Escalation process completed successfully',
        requestData: { orgId, results },
        responseData: results,
        userId,
        duration
    });
}

async function logEscalationProcessError(options) {
    const { orgId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ESCALATION_PROCESS_ERROR',
        module: 'WorkflowEscalationController',
        message: 'ERROR: Escalation process failed',
        requestData: { orgId, error: error.message || error },
        userId
    });
}

// ===== NEXT APPROVER OPERATIONS =====

async function logGetNextApproverApiCalled(options) {
    const { wfamshId, currentSequence, orgId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_NEXT_APPROVER_API_CALLED',
        module: 'WorkflowEscalationController',
        message: 'INFO: Get next approver API called',
        requestData: { wfamshId, currentSequence, orgId, ...requestData },
        userId,
        duration
    });
}

async function logValidatingNextApproverParams(options) {
    const { wfamshId, currentSequence, orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_NEXT_APPROVER_PARAMS',
        module: 'WorkflowEscalationController',
        message: 'INFO: Validating next approver parameters',
        requestData: { wfamshId, currentSequence, orgId, operation: 'validating_parameters' },
        userId
    });
}

async function logMissingWfamshId(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_WFAMSH_ID',
        module: 'WorkflowEscalationController',
        message: 'WARNING: WFAMSH ID is required',
        requestData: { message: 'WFAMSH ID is required' },
        userId
    });
}

async function logMissingCurrentSequence(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_CURRENT_SEQUENCE',
        module: 'WorkflowEscalationController',
        message: 'WARNING: Current sequence is required',
        requestData: { message: 'Current sequence is required' },
        userId
    });
}

async function logQueryingNextApprover(options) {
    const { wfamshId, currentSequence, orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_NEXT_APPROVER',
        module: 'WorkflowEscalationController',
        message: 'INFO: Querying next approver from database',
        requestData: { wfamshId, currentSequence, orgId, operation: 'fetch_next_approver' },
        userId
    });
}

async function logNextApproverFound(options) {
    const { wfamshId, nextApprover, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'NEXT_APPROVER_FOUND',
        module: 'WorkflowEscalationController',
        message: 'INFO: Next approver found',
        requestData: { wfamshId, nextApprover },
        userId
    });
}

async function logNoNextApproverFound(options) {
    const { wfamshId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'NO_NEXT_APPROVER_FOUND',
        module: 'WorkflowEscalationController',
        message: 'WARNING: No next approver found for this workflow',
        requestData: { wfamshId, message: 'No next approver found for this workflow' },
        userId
    });
}

async function logNextApproverRetrievalError(options) {
    const { wfamshId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'NEXT_APPROVER_RETRIEVAL_ERROR',
        module: 'WorkflowEscalationController',
        message: 'ERROR: Failed to retrieve next approver',
        requestData: { wfamshId, error: error.message || error },
        userId
    });
}

// ===== MANUAL ESCALATION OPERATIONS =====

async function logManualEscalateWorkflowApiCalled(options) {
    const { wfamsdId, nextWfamsdId, wfamshId, orgId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MANUAL_ESCALATE_WORKFLOW_API_CALLED',
        module: 'WorkflowEscalationController',
        message: 'INFO: Manual escalate workflow API called',
        requestData: { wfamsdId, nextWfamsdId, wfamshId, orgId, ...requestData },
        userId,
        duration
    });
}

async function logValidatingEscalationParams(options) {
    const { wfamsdId, nextWfamsdId, wfamshId, orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_ESCALATION_PARAMS',
        module: 'WorkflowEscalationController',
        message: 'INFO: Validating escalation parameters',
        requestData: { wfamsdId, nextWfamsdId, wfamshId, orgId, operation: 'validating_parameters' },
        userId
    });
}

async function logMissingEscalationParams(options) {
    const { missingParams, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_ESCALATION_PARAMS',
        module: 'WorkflowEscalationController',
        message: 'WARNING: Required escalation parameters are missing',
        requestData: { missingParams, message: 'wfamsdId, nextWfamsdId, and wfamshId are required' },
        userId
    });
}

async function logProcessingWorkflowEscalation(options) {
    const { wfamsdId, nextWfamsdId, wfamshId, orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'PROCESSING_WORKFLOW_ESCALATION',
        module: 'WorkflowEscalationController',
        message: 'INFO: Processing workflow escalation',
        requestData: { wfamsdId, nextWfamsdId, wfamshId, orgId, operation: 'escalating_workflow' },
        userId
    });
}

async function logEscalatingToNextApprover(options) {
    const { wfamsdId, nextWfamsdId, wfamshId, orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ESCALATING_TO_NEXT_APPROVER',
        module: 'WorkflowEscalationController',
        message: 'INFO: Escalating workflow to next approver',
        requestData: { wfamsdId, nextWfamsdId, wfamshId, orgId, operation: 'database_escalation' },
        userId
    });
}

async function logWorkflowEscalated(options) {
    const { wfamsdId, nextWfamsdId, wfamshId, orgId, result, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'WORKFLOW_ESCALATED',
        module: 'WorkflowEscalationController',
        message: 'INFO: Workflow escalated successfully',
        requestData: { wfamsdId, nextWfamsdId, wfamshId, orgId },
        responseData: result,
        userId,
        duration
    });
}

async function logWorkflowEscalationError(options) {
    const { wfamsdId, nextWfamsdId, wfamshId, orgId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'WORKFLOW_ESCALATION_ERROR',
        module: 'WorkflowEscalationController',
        message: 'ERROR: Failed to escalate workflow',
        requestData: { wfamsdId, nextWfamsdId, wfamshId, orgId, error: error.message || error },
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
        module: 'WorkflowEscalationController',
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
        module: 'WorkflowEscalationController',
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
        module: 'WorkflowEscalationController',
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
        module: 'WorkflowEscalationController',
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
        module: 'WorkflowEscalationController',
        message: 'ERROR: Failed to send email notification',
        requestData: { recipient, subject, error: error.message || error },
        userId
    });
}

// ===== SYSTEM OPERATIONS =====

async function logSystemEscalationTriggered(options) {
    const { orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SYSTEM_ESCALATION_TRIGGERED',
        module: 'WorkflowEscalationController',
        message: 'INFO: System escalation process triggered',
        requestData: { orgId, message: 'Automated escalation process started' },
        userId
    });
}

async function logManualEscalationTriggered(options) {
    const { orgId, triggeredBy, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MANUAL_ESCALATION_TRIGGERED',
        module: 'WorkflowEscalationController',
        message: 'INFO: Manual escalation process triggered',
        requestData: { orgId, triggeredBy, message: 'Manual escalation process started' },
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
        module: 'WorkflowEscalationController',
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
        module: 'WorkflowEscalationController',
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
        module: 'WorkflowEscalationController',
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
    
    // Overdue workflows operations
    logGetOverdueWorkflowsApiCalled,
    logQueryingOverdueWorkflows,
    logNoOverdueWorkflowsFound,
    logOverdueWorkflowsRetrieved,
    logOverdueWorkflowsRetrievalError,
    
    // Escalation process operations
    logTriggerEscalationProcessApiCalled,
    logProcessingEscalationWorkflows,
    logEscalationProcessCompleted,
    logEscalationProcessError,
    
    // Next approver operations
    logGetNextApproverApiCalled,
    logValidatingNextApproverParams,
    logMissingWfamshId,
    logMissingCurrentSequence,
    logQueryingNextApprover,
    logNextApproverFound,
    logNoNextApproverFound,
    logNextApproverRetrievalError,
    
    // Manual escalation operations
    logManualEscalateWorkflowApiCalled,
    logValidatingEscalationParams,
    logMissingEscalationParams,
    logProcessingWorkflowEscalation,
    logEscalatingToNextApprover,
    logWorkflowEscalated,
    logWorkflowEscalationError,
    
    // Database operations
    logDatabaseTransactionStarted,
    logDatabaseTransactionCompleted,
    logDatabaseTransactionRollback,
    
    // Email notifications
    logEmailNotificationSent,
    logEmailNotificationError,
    
    // System operations
    logSystemEscalationTriggered,
    logManualEscalationTriggered,
    
    // Database error handling
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation,
    logDataRetrievalError
};
