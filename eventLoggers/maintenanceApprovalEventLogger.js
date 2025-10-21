/**
 * Event Logger for Maintenance Approval Operations
 * 
 * This module handles all event logging for maintenance approval actions.
 * Logs are written to: logs/events/events_MAINTENANCEAPPROVAL_YYYY-MM-DD.csv
 * 
 * Log Levels:
 * - INFO: Normal operations (approve, reject, get approvals)
 * - WARNING: Missing data, validation failures
 * - ERROR: Operation failures, database errors
 * - CRITICAL: System-level failures, data integrity issues
 */

const eventLogger = require('../services/eventLogger');

// ==================== GENERIC LOGGING HELPERS ====================

/**
 * Generic API call logger (INFO)
 */
async function logApiCall(options) {
    const { operation, method, url, requestData, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'API_CALL',
        module: 'ApprovalDetailController',
        message: `INFO: ${method} ${url} - ${operation}`,
        logLevel: 'INFO',
        requestData: { operation, method, url, ...requestData },
        responseData: { status: 'processing' },
        duration: null,
        userId
    });
}

/**
 * Generic operation success logger (INFO)
 */
async function logOperationSuccess(options) {
    const { operation, requestData, responseData, duration, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'APPROVAL_OPERATION',
        module: 'ApprovalDetailController',
        message: `INFO: ${operation} completed successfully`,
        logLevel: 'INFO',
        requestData,
        responseData: { success: true, ...responseData },
        duration,
        userId
    });
}

/**
 * Generic operation error logger (ERROR)
 */
async function logOperationError(options) {
    const { operation, requestData, error, duration, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'APPROVAL_OPERATION',
        module: 'ApprovalDetailController',
        message: `ERROR: ${operation} failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData,
        responseData: { error: error.message, code: error.code },
        duration,
        userId
    });
}

// ==================== DETAILED FLOW LOGGING - APPROVE MAINTENANCE ====================

/**
 * Log approve maintenance API called (INFO)
 */
async function logApproveMaintenanceApiCalled(options) {
    const { assetId, empIntId, note, orgId, method, url, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'API_CALL',
        module: 'ApprovalDetailController',
        message: `INFO: ${method} ${url} - Approve Maintenance Request`,
        logLevel: 'INFO',
        requestData: {
            asset_id: assetId,
            emp_int_id: empIntId,
            note: note || 'No note provided',
            org_id: orgId,
            operation: 'approve_maintenance'
        },
        responseData: { status: 'processing' },
        duration: null,
        userId
    });
}

/**
 * Log validating approval request (INFO)
 */
async function logValidatingApprovalRequest(options) {
    const { assetId, empIntId, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'VALIDATION',
        module: 'ApprovalDetailController',
        message: 'INFO: Validating approval request parameters',
        logLevel: 'INFO',
        requestData: { asset_id: assetId, emp_int_id: empIntId },
        responseData: { validation_status: 'in_progress' },
        duration: null,
        userId
    });
}

/**
 * Log processing approval in database (INFO)
 */
async function logProcessingApproval(options) {
    const { assetId, empIntId, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'DB_OPERATION',
        module: 'ApprovalDetailController',
        message: 'INFO: Processing maintenance approval in database',
        logLevel: 'INFO',
        requestData: {
            asset_id: assetId,
            emp_int_id: empIntId,
            action: 'approve'
        },
        responseData: { status: 'executing' },
        duration: null,
        userId
    });
}

/**
 * Log maintenance approved successfully (INFO)
 */
async function logMaintenanceApproved(options) {
    const { assetId, empIntId, note, resultMessage, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'MAINTENANCE_APPROVED',
        module: 'ApprovalDetailController',
        message: `INFO: Maintenance approved successfully for asset ${assetId}`,
        logLevel: 'INFO',
        requestData: {
            asset_id: assetId,
            approved_by: empIntId,
            approval_note: note
        },
        responseData: {
            success: true,
            message: resultMessage,
            action_taken: 'approved'
        },
        duration,
        userId
    });
}

// ==================== DETAILED FLOW LOGGING - REJECT MAINTENANCE ====================

/**
 * Log reject maintenance API called (INFO)
 */
async function logRejectMaintenanceApiCalled(options) {
    const { assetId, empIntId, reason, orgId, method, url, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'API_CALL',
        module: 'ApprovalDetailController',
        message: `INFO: ${method} ${url} - Reject Maintenance Request`,
        logLevel: 'INFO',
        requestData: {
            asset_id: assetId,
            emp_int_id: empIntId,
            rejection_reason: reason,
            org_id: orgId,
            operation: 'reject_maintenance'
        },
        responseData: { status: 'processing' },
        duration: null,
        userId
    });
}

/**
 * Log validating rejection reason (WARNING)
 */
async function logValidatingRejectionReason(options) {
    const { assetId, reason, isValid, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'VALIDATION',
        module: 'ApprovalDetailController',
        message: isValid 
            ? 'INFO: Rejection reason validated successfully' 
            : 'WARNING: Rejection reason validation failed - reason is required',
        logLevel: isValid ? 'INFO' : 'WARNING',
        requestData: {
            asset_id: assetId,
            reason_provided: !!reason,
            reason_length: reason ? reason.length : 0
        },
        responseData: { 
            validation_passed: isValid,
            message: isValid ? 'Valid reason provided' : 'Reason is required'
        },
        duration: null,
        userId
    });
}

/**
 * Log processing rejection in database (INFO)
 */
async function logProcessingRejection(options) {
    const { assetId, empIntId, reason, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'DB_OPERATION',
        module: 'ApprovalDetailController',
        message: 'INFO: Processing maintenance rejection in database',
        logLevel: 'INFO',
        requestData: {
            asset_id: assetId,
            emp_int_id: empIntId,
            action: 'reject',
            rejection_reason: reason
        },
        responseData: { status: 'executing' },
        duration: null,
        userId
    });
}

/**
 * Log maintenance rejected successfully (INFO)
 */
async function logMaintenanceRejected(options) {
    const { assetId, empIntId, reason, resultMessage, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'MAINTENANCE_REJECTED',
        module: 'ApprovalDetailController',
        message: `INFO: Maintenance rejected for asset ${assetId}`,
        logLevel: 'INFO',
        requestData: {
            asset_id: assetId,
            rejected_by: empIntId,
            rejection_reason: reason
        },
        responseData: {
            success: true,
            message: resultMessage,
            action_taken: 'rejected'
        },
        duration,
        userId
    });
}

// ==================== INFO LEVEL EVENTS ====================

/**
 * Log approvals retrieved (INFO)
 */
async function logApprovalsRetrieved(options) {
    const { empIntId, count, orgId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'DATA_RETRIEVAL',
        module: 'ApprovalDetailController',
        message: `INFO: Retrieved ${count} maintenance approvals for employee`,
        logLevel: 'INFO',
        requestData: { emp_int_id: empIntId, org_id: orgId },
        responseData: { 
            approvals_count: count,
            retrieved_successfully: true
        },
        duration,
        userId
    });
}

/**
 * Log approval detail retrieved (INFO)
 */
async function logApprovalDetailRetrieved(options) {
    const { assetId, wfamsdId, orgId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'DATA_RETRIEVAL',
        module: 'ApprovalDetailController',
        message: `INFO: Retrieved approval detail for asset ${assetId}`,
        logLevel: 'INFO',
        requestData: { asset_id: assetId, org_id: orgId },
        responseData: { 
            wfamsd_id: wfamsdId,
            found: true
        },
        duration,
        userId
    });
}

/**
 * Log workflow history retrieved (INFO)
 */
async function logWorkflowHistoryRetrieved(options) {
    const { assetId, count, orgId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'DATA_RETRIEVAL',
        module: 'ApprovalDetailController',
        message: `INFO: Retrieved ${count} workflow history records`,
        logLevel: 'INFO',
        requestData: { asset_id: assetId, org_id: orgId },
        responseData: { 
            history_count: count,
            retrieved_successfully: true
        },
        duration,
        userId
    });
}

// ==================== WARNING LEVEL EVENTS ====================

/**
 * Log missing required fields (WARNING)
 */
async function logMissingRequiredFields(options) {
    const { operation, missingFields, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'VALIDATION_ERROR',
        module: 'ApprovalDetailController',
        message: `WARNING: ${operation} - Missing required fields`,
        logLevel: 'WARNING',
        requestData: { operation },
        responseData: { 
            missing_fields: missingFields,
            validation_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log approval not found (WARNING)
 */
async function logApprovalNotFound(options) {
    const { assetId, orgId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'NOT_FOUND',
        module: 'ApprovalDetailController',
        message: `WARNING: No approval detail found for asset ${assetId}`,
        logLevel: 'WARNING',
        requestData: { asset_id: assetId, org_id: orgId },
        responseData: { 
            found: false,
            reason: 'No matching approval record'
        },
        duration,
        userId
    });
}

/**
 * Log employee has no approvals (WARNING)
 */
async function logNoApprovalsForEmployee(options) {
    const { empIntId, orgId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'NO_DATA',
        module: 'ApprovalDetailController',
        message: `WARNING: No maintenance approvals found for employee ${empIntId}`,
        logLevel: 'WARNING',
        requestData: { emp_int_id: empIntId, org_id: orgId },
        responseData: { 
            approvals_count: 0,
            reason: 'No pending approvals for this employee'
        },
        duration,
        userId
    });
}

// ==================== ERROR LEVEL EVENTS ====================

/**
 * Log approval operation error (ERROR)
 */
async function logApprovalOperationError(options) {
    const { operation, assetId, empIntId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'OPERATION_ERROR',
        module: 'ApprovalDetailController',
        message: `ERROR: ${operation} failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            operation,
            asset_id: assetId,
            emp_int_id: empIntId
        },
        responseData: { 
            error: error.message,
            error_code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        duration,
        userId
    });
}

/**
 * Log data retrieval error (ERROR)
 */
async function logDataRetrievalError(options) {
    const { operation, params, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'RETRIEVAL_ERROR',
        module: 'ApprovalDetailController',
        message: `ERROR: Failed to retrieve ${operation} - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { operation, ...params },
        responseData: { 
            error: error.message,
            error_code: error.code
        },
        duration,
        userId
    });
}

// ==================== CRITICAL LEVEL EVENTS ====================

/**
 * Log database connection failure (CRITICAL)
 */
async function logDatabaseConnectionFailure(options) {
    const { operation, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'DB_CONNECTION_FAILURE',
        module: 'ApprovalDetailController',
        message: `CRITICAL: Database connection failed during ${operation}`,
        logLevel: 'CRITICAL',
        requestData: { operation },
        responseData: { 
            error: error.message,
            error_code: error.code,
            system_impact: 'high'
        },
        duration,
        userId
    });
}

/**
 * Log database constraint violation (CRITICAL)
 */
async function logDatabaseConstraintViolation(options) {
    const { operation, error, assetId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'MAINTENANCEAPPROVAL',
        eventType: 'DB_CONSTRAINT_VIOLATION',
        module: 'ApprovalDetailController',
        message: `CRITICAL: Database constraint violation during ${operation}`,
        logLevel: 'CRITICAL',
        requestData: { 
            operation,
            asset_id: assetId
        },
        responseData: { 
            error: error.message,
            constraint: error.constraint,
            error_code: error.code
        },
        duration,
        userId
    });
}

module.exports = {
    // Generic helpers
    logApiCall,
    logOperationSuccess,
    logOperationError,
    // Detailed flow - Approve
    logApproveMaintenanceApiCalled,
    logValidatingApprovalRequest,
    logProcessingApproval,
    logMaintenanceApproved,
    // Detailed flow - Reject
    logRejectMaintenanceApiCalled,
    logValidatingRejectionReason,
    logProcessingRejection,
    logMaintenanceRejected,
    // INFO
    logApprovalsRetrieved,
    logApprovalDetailRetrieved,
    logWorkflowHistoryRetrieved,
    // WARNING
    logMissingRequiredFields,
    logApprovalNotFound,
    logNoApprovalsForEmployee,
    // ERROR
    logApprovalOperationError,
    logDataRetrievalError,
    // CRITICAL
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation
};

