const eventLogger = require('../services/eventLogger');

const APP_ID = 'SUPERVISORAPPROVAL';

// ============================================================================
// GENERIC LOGGING FUNCTIONS
// ============================================================================

/**
 * Log API call initiation
 */
async function logApiCall(options) {
    const { operation, method, url, requestData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'SupervisorApprovalController',
        message: `INFO: ${method} ${url} - ${operation} API called`,
        logLevel: 'INFO',
        requestData: {
            method,
            url,
            operation,
            ...requestData
        },
        responseData: { status: 'Request received, processing...' },
        duration: null,
        userId
    });
}

/**
 * Log successful operation completion
 */
async function logOperationSuccess(options) {
    const { operation, requestData, responseData, duration, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'OPERATION_SUCCESS',
        module: 'SupervisorApprovalController',
        message: `INFO: ${operation} completed successfully`,
        logLevel: 'INFO',
        requestData,
        responseData,
        duration,
        userId
    });
}

/**
 * Log operation error
 */
async function logOperationError(options) {
    const { operation, error, requestData, duration, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'OPERATION_ERROR',
        module: 'SupervisorApprovalController',
        message: `ERROR: ${operation} failed - ${error}`,
        logLevel: 'ERROR',
        requestData,
        responseData: { error: error.message || error },
        duration,
        userId
    });
}

// ============================================================================
// SUPERVISOR APPROVAL SPECIFIC LOGGING
// ============================================================================

/**
 * Log supervisor approval list fetch API call
 */
async function logSupervisorApprovalListApiCalled(options) {
    const { method, url, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'SupervisorApprovalController',
        message: `INFO: GET ${url} - Supervisor approval list fetch API called`,
        logLevel: 'INFO',
        requestData: {
            method,
            url,
            operation: 'fetchSupervisorApprovals'
        },
        responseData: { status: 'Request received, fetching supervisor approvals' },
        duration: null,
        userId
    });
}

/**
 * Log supervisor approval detail fetch API call
 */
async function logSupervisorApprovalDetailApiCalled(options) {
    const { method, url, wfamshId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'SupervisorApprovalController',
        message: `INFO: GET ${url} - Supervisor approval detail fetch API called`,
        logLevel: 'INFO',
        requestData: {
            method,
            url,
            wfamsh_id: wfamshId,
            operation: 'fetchSupervisorApprovalDetail'
        },
        responseData: { status: 'Request received, fetching approval detail' },
        duration: null,
        userId
    });
}

/**
 * Log supervisor approval action API call
 */
async function logSupervisorApprovalActionApiCalled(options) {
    const { method, url, wfamshId, action, empIntId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'SupervisorApprovalController',
        message: `INFO: POST ${url} - Supervisor ${action} API called`,
        logLevel: 'INFO',
        requestData: {
            method,
            url,
            wfamsh_id: wfamshId,
            action,
            emp_int_id: empIntId,
            operation: `supervisor${action.charAt(0).toUpperCase() + action.slice(1)}`
        },
        responseData: { status: `Request received, processing ${action}` },
        duration: null,
        userId
    });
}

/**
 * Log checklist fetch API call
 */
async function logChecklistFetchApiCalled(options) {
    const { method, url, assetTypeId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'SupervisorApprovalController',
        message: `INFO: GET ${url} - Checklist fetch API called`,
        logLevel: 'INFO',
        requestData: {
            method,
            url,
            asset_type_id: assetTypeId,
            operation: 'fetchChecklist'
        },
        responseData: { status: 'Request received, fetching checklist' },
        duration: null,
        userId
    });
}

/**
 * Log maintenance documents fetch API call
 */
async function logMaintenanceDocsFetchApiCalled(options) {
    const { method, url, assetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'SupervisorApprovalController',
        message: `INFO: GET ${url} - Maintenance documents fetch API called`,
        logLevel: 'INFO',
        requestData: {
            method,
            url,
            asset_id: assetId,
            operation: 'fetchMaintenanceDocuments'
        },
        responseData: { status: 'Request received, fetching maintenance documents' },
        duration: null,
        userId
    });
}

/**
 * Log document upload API call
 */
async function logDocumentUploadApiCalled(options) {
    const { method, url, assetId, docType, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'SupervisorApprovalController',
        message: `INFO: POST ${url} - Document upload API called`,
        logLevel: 'INFO',
        requestData: {
            method,
            url,
            asset_id: assetId,
            doc_type: docType,
            operation: 'uploadDocument'
        },
        responseData: { status: 'Request received, processing document upload' },
        duration: null,
        userId
    });
}

/**
 * Log maintenance update API call
 */
async function logMaintenanceUpdateApiCalled(options) {
    const { method, url, wfamshId, updateData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'SupervisorApprovalController',
        message: `INFO: PUT ${url} - Maintenance update API called`,
        logLevel: 'INFO',
        requestData: {
            method,
            url,
            wfamsh_id: wfamshId,
            update_fields: Object.keys(updateData),
            operation: 'updateMaintenance'
        },
        responseData: { status: 'Request received, processing maintenance update' },
        duration: null,
        userId
    });
}

// ============================================================================
// DATABASE OPERATIONS LOGGING
// ============================================================================

/**
 * Log database query execution
 */
async function logDatabaseQuery(options) {
    const { query, params, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'SupervisorApprovalController',
        message: `INFO: Executing database query - ${query}`,
        logLevel: 'INFO',
        requestData: {
            query,
            params
        },
        responseData: { status: 'Executing query' },
        duration: null,
        userId
    });
}

/**
 * Log data retrieval success
 */
async function logDataRetrieved(options) {
    const { operation, count, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_RETRIEVED',
        module: 'SupervisorApprovalController',
        message: `INFO: Retrieved ${count} records for ${operation}`,
        logLevel: 'INFO',
        requestData: { operation },
        responseData: {
            count,
            has_data: count > 0
        },
        duration,
        userId
    });
}

/**
 * Log data update success
 */
async function logDataUpdated(options) {
    const { operation, recordId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_UPDATED',
        module: 'SupervisorApprovalController',
        message: `INFO: Successfully updated ${operation} - ID: ${recordId}`,
        logLevel: 'INFO',
        requestData: { operation, record_id: recordId },
        responseData: { updated: true },
        duration,
        userId
    });
}

/**
 * Log data insertion success
 */
async function logDataInserted(options) {
    const { operation, recordId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_INSERTED',
        module: 'SupervisorApprovalController',
        message: `INFO: Successfully inserted ${operation} - ID: ${recordId}`,
        logLevel: 'INFO',
        requestData: { operation, record_id: recordId },
        responseData: { inserted: true },
        duration,
        userId
    });
}

// ============================================================================
// VALIDATION LOGGING
// ============================================================================

/**
 * Log parameter validation
 */
async function logValidatingParameters(options) {
    const { operation, parameters, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'SupervisorApprovalController',
        message: `INFO: Validating parameters for ${operation}`,
        logLevel: 'INFO',
        requestData: {
            operation,
            parameters
        },
        responseData: { status: 'Validating parameters' },
        duration: null,
        userId
    });
}

/**
 * Log missing required fields
 */
async function logMissingRequiredFields(options) {
    const { operation, missingFields, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION_ERROR',
        module: 'SupervisorApprovalController',
        message: `WARNING: Missing required fields for ${operation}: ${missingFields.join(', ')}`,
        logLevel: 'WARNING',
        requestData: {
            operation,
            missing_fields: missingFields
        },
        responseData: { validation_failed: true },
        duration,
        userId
    });
}

/**
 * Log validation success
 */
async function logValidationSuccess(options) {
    const { operation, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION_SUCCESS',
        module: 'SupervisorApprovalController',
        message: `INFO: Validation successful for ${operation}`,
        logLevel: 'INFO',
        requestData: { operation },
        responseData: { validation_passed: true },
        duration: null,
        userId
    });
}

// ============================================================================
// BUSINESS LOGIC LOGGING
// ============================================================================

/**
 * Log supervisor approval processing
 */
async function logProcessingSupervisorApproval(options) {
    const { wfamshId, action, empIntId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'BUSINESS_LOGIC',
        module: 'SupervisorApprovalController',
        message: `INFO: Processing supervisor ${action} for workflow ${wfamshId}`,
        logLevel: 'INFO',
        requestData: {
            wfamsh_id: wfamshId,
            action,
            emp_int_id: empIntId
        },
        responseData: { status: 'Processing approval action' },
        duration: null,
        userId
    });
}

/**
 * Log role-based access check
 */
async function logCheckingUserRoles(options) {
    const { empIntId, requiredRoles, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ACCESS_CONTROL',
        module: 'SupervisorApprovalController',
        message: `INFO: Checking user roles for employee ${empIntId}`,
        logLevel: 'INFO',
        requestData: {
            emp_int_id: empIntId,
            required_roles: requiredRoles
        },
        responseData: { status: 'Checking role permissions' },
        duration: null,
        userId
    });
}

/**
 * Log role validation success
 */
async function logRoleValidationSuccess(options) {
    const { empIntId, userRoles, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ACCESS_CONTROL',
        module: 'SupervisorApprovalController',
        message: `INFO: User ${empIntId} has required roles: ${userRoles.join(', ')}`,
        logLevel: 'INFO',
        requestData: {
            emp_int_id: empIntId,
            user_roles: userRoles
        },
        responseData: { access_granted: true },
        duration: null,
        userId
    });
}

/**
 * Log workflow step update
 */
async function logWorkflowStepUpdated(options) {
    const { wfamshId, stepId, newStatus, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'WORKFLOW_UPDATE',
        module: 'SupervisorApprovalController',
        message: `INFO: Updated workflow step ${stepId} to status ${newStatus}`,
        logLevel: 'INFO',
        requestData: {
            wfamsh_id: wfamshId,
            step_id: stepId,
            new_status: newStatus
        },
        responseData: { step_updated: true },
        duration: null,
        userId
    });
}

/**
 * Log supervisor approval completed
 */
async function logSupervisorApprovalCompleted(options) {
    const { wfamshId, action, empIntId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'SUPERVISOR_APPROVAL_COMPLETED',
        module: 'SupervisorApprovalController',
        message: `INFO: Supervisor ${action} completed successfully for workflow ${wfamshId}`,
        logLevel: 'INFO',
        requestData: {
            wfamsh_id: wfamshId,
            action,
            emp_int_id: empIntId
        },
        responseData: { approval_completed: true },
        duration,
        userId
    });
}

// ============================================================================
// WARNING LEVEL LOGGING
// ============================================================================

/**
 * Log no supervisor approvals found
 */
async function logNoSupervisorApprovalsFound(options) {
    const { empIntId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'NO_DATA_FOUND',
        module: 'SupervisorApprovalController',
        message: `WARNING: No supervisor approvals found for employee ${empIntId}`,
        logLevel: 'WARNING',
        requestData: {
            emp_int_id: empIntId
        },
        responseData: { count: 0, has_approvals: false },
        duration,
        userId
    });
}

/**
 * Log approval not found
 */
async function logApprovalNotFound(options) {
    const { wfamshId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'APPROVAL_NOT_FOUND',
        module: 'SupervisorApprovalController',
        message: `WARNING: Supervisor approval not found for workflow ${wfamshId}`,
        logLevel: 'WARNING',
        requestData: {
            wfamsh_id: wfamshId
        },
        responseData: { found: false },
        duration,
        userId
    });
}

/**
 * Log insufficient permissions
 */
async function logInsufficientPermissions(options) {
    const { empIntId, requiredRoles, userRoles, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ACCESS_DENIED',
        module: 'SupervisorApprovalController',
        message: `WARNING: Employee ${empIntId} lacks required roles for supervisor approval`,
        logLevel: 'WARNING',
        requestData: {
            emp_int_id: empIntId,
            required_roles: requiredRoles,
            user_roles: userRoles
        },
        responseData: { access_denied: true },
        duration: null,
        userId
    });
}

/**
 * Log workflow already processed
 */
async function logWorkflowAlreadyProcessed(options) {
    const { wfamshId, currentStatus, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'WORKFLOW_ALREADY_PROCESSED',
        module: 'SupervisorApprovalController',
        message: `WARNING: Workflow ${wfamshId} already processed with status ${currentStatus}`,
        logLevel: 'WARNING',
        requestData: {
            wfamsh_id: wfamshId,
            current_status: currentStatus
        },
        responseData: { already_processed: true },
        duration: null,
        userId
    });
}

// ============================================================================
// ERROR LEVEL LOGGING
// ============================================================================

/**
 * Log supervisor approval operation error
 */
async function logSupervisorApprovalOperationError(options) {
    const { operation, wfamshId, empIntId, error, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'SUPERVISOR_APPROVAL_ERROR',
        module: 'SupervisorApprovalController',
        message: `ERROR: ${operation} failed for workflow ${wfamshId} - ${error}`,
        logLevel: 'ERROR',
        requestData: {
            operation,
            wfamsh_id: wfamshId,
            emp_int_id: empIntId
        },
        responseData: { error: error.message || error },
        duration,
        userId
    });
}

/**
 * Log data retrieval error
 */
async function logDataRetrievalError(options) {
    const { operation, error, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_RETRIEVAL_ERROR',
        module: 'SupervisorApprovalController',
        message: `ERROR: Failed to retrieve data for ${operation} - ${error}`,
        logLevel: 'ERROR',
        requestData: { operation },
        responseData: { error: error.message || error },
        duration,
        userId
    });
}

/**
 * Log document upload error
 */
async function logDocumentUploadError(options) {
    const { assetId, docType, error, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DOCUMENT_UPLOAD_ERROR',
        module: 'SupervisorApprovalController',
        message: `ERROR: Document upload failed for asset ${assetId} - ${error}`,
        logLevel: 'ERROR',
        requestData: {
            asset_id: assetId,
            doc_type: docType
        },
        responseData: { error: error.message || error },
        duration,
        userId
    });
}

/**
 * Log maintenance update error
 */
async function logMaintenanceUpdateError(options) {
    const { wfamshId, updateData, error, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'MAINTENANCE_UPDATE_ERROR',
        module: 'SupervisorApprovalController',
        message: `ERROR: Maintenance update failed for workflow ${wfamshId} - ${error}`,
        logLevel: 'ERROR',
        requestData: {
            wfamsh_id: wfamshId,
            update_fields: Object.keys(updateData)
        },
        responseData: { error: error.message || error },
        duration,
        userId
    });
}

// ============================================================================
// CRITICAL LEVEL LOGGING
// ============================================================================

/**
 * Log database connection failure
 */
async function logDatabaseConnectionFailure(options) {
    const { operation, error, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATABASE_CONNECTION_FAILURE',
        module: 'SupervisorApprovalController',
        message: `CRITICAL: Database connection failed during ${operation}`,
        logLevel: 'CRITICAL',
        requestData: { operation },
        responseData: { 
            error: error.message || error,
            connection_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log database constraint violation
 */
async function logDatabaseConstraintViolation(options) {
    const { operation, wfamshId, error, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATABASE_CONSTRAINT_VIOLATION',
        module: 'SupervisorApprovalController',
        message: `CRITICAL: Database constraint violation during ${operation} for workflow ${wfamshId}`,
        logLevel: 'CRITICAL',
        requestData: {
            operation,
            wfamsh_id: wfamshId
        },
        responseData: { 
            error: error.message || error,
            constraint_violation: true
        },
        duration,
        userId
    });
}

/**
 * Log system integrity violation
 */
async function logSystemIntegrityViolation(options) {
    const { operation, wfamshId, violation, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'SYSTEM_INTEGRITY_VIOLATION',
        module: 'SupervisorApprovalController',
        message: `CRITICAL: System integrity violation during ${operation} for workflow ${wfamshId}`,
        logLevel: 'CRITICAL',
        requestData: {
            operation,
            wfamsh_id: wfamshId,
            violation
        },
        responseData: { 
            integrity_violation: true,
            violation_details: violation
        },
        duration,
        userId
    });
}

/**
 * Log unauthorized access attempt
 */
async function logUnauthorizedAccessAttempt(options) {
    const { operation, empIntId, ipAddress, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        module: 'SupervisorApprovalController',
        message: `CRITICAL: Unauthorized access attempt for ${operation} by employee ${empIntId}`,
        logLevel: 'CRITICAL',
        requestData: {
            operation,
            emp_int_id: empIntId,
            ip_address: ipAddress
        },
        responseData: { 
            unauthorized_access: true,
            security_threat: true
        },
        duration: null,
        userId
    });
}

// ============================================================================
// SUCCESS LOGGING
// ============================================================================

/**
 * Log supervisor approvals retrieved successfully
 */
async function logSupervisorApprovalsRetrieved(options) {
    const { count, empIntId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'SUPERVISOR_APPROVALS_RETRIEVED',
        module: 'SupervisorApprovalController',
        message: `INFO: Retrieved ${count} supervisor approvals for employee ${empIntId}`,
        logLevel: 'INFO',
        requestData: {
            emp_int_id: empIntId
        },
        responseData: {
            count,
            has_approvals: count > 0
        },
        duration,
        userId
    });
}

/**
 * Log supervisor approval detail retrieved successfully
 */
async function logSupervisorApprovalDetailRetrieved(options) {
    const { wfamshId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'SUPERVISOR_APPROVAL_DETAIL_RETRIEVED',
        module: 'SupervisorApprovalController',
        message: `INFO: Retrieved supervisor approval detail for workflow ${wfamshId}`,
        logLevel: 'INFO',
        requestData: {
            wfamsh_id: wfamshId
        },
        responseData: {
            found: true,
            detail_retrieved: true
        },
        duration,
        userId
    });
}

/**
 * Log checklist retrieved successfully
 */
async function logChecklistRetrieved(options) {
    const { assetTypeId, count, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'CHECKLIST_RETRIEVED',
        module: 'SupervisorApprovalController',
        message: `INFO: Retrieved ${count} checklist items for asset type ${assetTypeId}`,
        logLevel: 'INFO',
        requestData: {
            asset_type_id: assetTypeId
        },
        responseData: {
            count,
            has_checklist: count > 0
        },
        duration,
        userId
    });
}

/**
 * Log maintenance documents retrieved successfully
 */
async function logMaintenanceDocumentsRetrieved(options) {
    const { assetId, count, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'MAINTENANCE_DOCUMENTS_RETRIEVED',
        module: 'SupervisorApprovalController',
        message: `INFO: Retrieved ${count} maintenance documents for asset ${assetId}`,
        logLevel: 'INFO',
        requestData: {
            asset_id: assetId
        },
        responseData: {
            count,
            has_documents: count > 0
        },
        duration,
        userId
    });
}

/**
 * Log document uploaded successfully
 */
async function logDocumentUploaded(options) {
    const { assetId, docType, docId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DOCUMENT_UPLOADED',
        module: 'SupervisorApprovalController',
        message: `INFO: Document uploaded successfully for asset ${assetId} - Type: ${docType}`,
        logLevel: 'INFO',
        requestData: {
            asset_id: assetId,
            doc_type: docType
        },
        responseData: {
            doc_id: docId,
            uploaded: true
        },
        duration,
        userId
    });
}

/**
 * Log maintenance updated successfully
 */
async function logMaintenanceUpdated(options) {
    const { wfamshId, updateFields, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'MAINTENANCE_UPDATED',
        module: 'SupervisorApprovalController',
        message: `INFO: Maintenance updated successfully for workflow ${wfamshId}`,
        logLevel: 'INFO',
        requestData: {
            wfamsh_id: wfamshId,
            update_fields: updateFields
        },
        responseData: {
            updated: true,
            fields_updated: updateFields
        },
        duration,
        userId
    });
}

module.exports = {
    // Generic functions
    logApiCall,
    logOperationSuccess,
    logOperationError,
    
    // API call logging
    logSupervisorApprovalListApiCalled,
    logSupervisorApprovalDetailApiCalled,
    logSupervisorApprovalActionApiCalled,
    logChecklistFetchApiCalled,
    logMaintenanceDocsFetchApiCalled,
    logDocumentUploadApiCalled,
    logMaintenanceUpdateApiCalled,
    
    // Database operations
    logDatabaseQuery,
    logDataRetrieved,
    logDataUpdated,
    logDataInserted,
    
    // Validation
    logValidatingParameters,
    logMissingRequiredFields,
    logValidationSuccess,
    
    // Business logic
    logProcessingSupervisorApproval,
    logCheckingUserRoles,
    logRoleValidationSuccess,
    logWorkflowStepUpdated,
    logSupervisorApprovalCompleted,
    
    // Warnings
    logNoSupervisorApprovalsFound,
    logApprovalNotFound,
    logInsufficientPermissions,
    logWorkflowAlreadyProcessed,
    
    // Errors
    logSupervisorApprovalOperationError,
    logDataRetrievalError,
    logDocumentUploadError,
    logMaintenanceUpdateError,
    
    // Critical
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation,
    logSystemIntegrityViolation,
    logUnauthorizedAccessAttempt,
    
    // Success
    logSupervisorApprovalsRetrieved,
    logSupervisorApprovalDetailRetrieved,
    logChecklistRetrieved,
    logMaintenanceDocumentsRetrieved,
    logDocumentUploaded,
    logMaintenanceUpdated
};
