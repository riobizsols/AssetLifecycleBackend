/**
 * Event Logger for Department Assignment (DEPTASSIGNMENT)
 * 
 * This module handles event logging for department-wise asset assignment operations.
 * Logs are written to: events_DEPTASSIGNMENT_YYYY-MM-DD.csv
 * 
 * Operations tracked:
 * - Asset assignment to departments
 * - Asset unassignment from departments
 * - Assignment history viewing
 * - Asset type filtering
 * - Available asset viewing
 * 
 * Log Levels:
 * - INFO: Normal operations (assignment, unassignment, viewing)
 * - WARNING: Validation failures, missing parameters, unauthorized access
 * - ERROR: Assignment failures, database errors
 * - CRITICAL: System-level failures, data integrity issues
 */

const eventLogger = require('../services/eventLogger');

const APP_ID = 'DEPTASSIGNMENT';

// ==================== DETAILED FLOW LOGGING ====================

/**
 * Log assignment API called (INFO)
 */
async function logAssignmentApiCalled(options) {
    const { method, url, assetId, deptId, orgId, userId, requestBody } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'AssetAssignmentController',
        message: `INFO: ${method} ${url} - Department assignment API called`,
        logLevel: 'INFO',
        requestData: { 
            method, 
            url,
            asset_id: assetId,
            dept_id: deptId,
            org_id: orgId,
            asset_assign_id: requestBody?.asset_assign_id,
            latest_assignment_flag: requestBody?.latest_assignment_flag
        },
        responseData: { status: 'Request received, starting processing' },
        duration: null,
        userId
    });
}

/**
 * Log validating assignment parameters (INFO)
 */
async function logValidatingParameters(options) {
    const { assetId, deptId, orgId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'AssetAssignmentController',
        message: `INFO: Validating assignment parameters`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId,
            org_id: orgId
        },
        responseData: { status: 'validating' },
        duration: null,
        userId
    });
}

/**
 * Log checking asset type assignment type (INFO)
 */
async function logCheckingAssetTypeAssignment(options) {
    const { assetId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Checking asset type assignment configuration`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            query: 'getAssetTypeAssignmentType'
        },
        responseData: { status: 'querying database' },
        duration: null,
        userId
    });
}

/**
 * Log asset type validated for department (INFO)
 */
async function logAssetTypeValidated(options) {
    const { assetId, assignmentType, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'AssetAssignmentController',
        message: `INFO: Asset type validated for department assignment - Type: ${assignmentType}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            assignment_type: assignmentType
        },
        responseData: { 
            valid: true,
            assignment_type_matches: assignmentType === 'Department'
        },
        duration: null,
        userId
    });
}

/**
 * Log checking department exists (INFO)
 */
async function logCheckingDepartmentExists(options) {
    const { deptId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Validating department exists in database`,
        logLevel: 'INFO',
        requestData: { 
            dept_id: deptId,
            query: 'checkDepartmentExists'
        },
        responseData: { status: 'querying database' },
        duration: null,
        userId
    });
}

/**
 * Log department validated (INFO)
 */
async function logDepartmentValidated(options) {
    const { deptId, deptName, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'AssetAssignmentController',
        message: `INFO: Department validated successfully - ${deptName}`,
        logLevel: 'INFO',
        requestData: { dept_id: deptId },
        responseData: { 
            valid: true,
            department_exists: true,
            department_name: deptName
        },
        duration: null,
        userId
    });
}

/**
 * Log checking for existing assignment (INFO)
 */
async function logCheckingExistingAssignment(options) {
    const { assetId, deptId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Checking for existing assignment`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId,
            query: 'checkAssetAssignmentExists'
        },
        responseData: { status: 'querying database' },
        duration: null,
        userId
    });
}

/**
 * Log no existing assignment found (INFO)
 */
async function logNoExistingAssignment(options) {
    const { assetId, deptId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'AssetAssignmentController',
        message: `INFO: No existing assignment found - proceeding with assignment`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId
        },
        responseData: { 
            existing_assignment: false,
            can_proceed: true
        },
        duration: null,
        userId
    });
}

/**
 * Log generating assignment ID (INFO)
 */
async function logGeneratingAssignmentId(options) {
    const { userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ID_GENERATION',
        module: 'AssetAssignmentController',
        message: `INFO: Generating assignment ID`,
        logLevel: 'INFO',
        requestData: { operation: 'generateAssignmentId' },
        responseData: { status: 'generating' },
        duration: null,
        userId
    });
}

/**
 * Log assignment ID generated (INFO)
 */
async function logAssignmentIdGenerated(options) {
    const { assignmentId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ID_GENERATION',
        module: 'AssetAssignmentController',
        message: `INFO: Assignment ID generated - ${assignmentId}`,
        logLevel: 'INFO',
        requestData: { assignment_id: assignmentId },
        responseData: { 
            id_generated: true,
            assignment_id: assignmentId
        },
        duration: null,
        userId
    });
}

/**
 * Log inserting assignment to database (INFO)
 */
async function logInsertingAssignmentToDatabase(options) {
    const { assignmentId, assetId, deptId, orgId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Inserting assignment to database`,
        logLevel: 'INFO',
        requestData: { 
            assignment_id: assignmentId,
            asset_id: assetId,
            dept_id: deptId,
            org_id: orgId,
            query: 'INSERT INTO tblAssetAssignment'
        },
        responseData: { status: 'executing INSERT query' },
        duration: null,
        userId
    });
}

/**
 * Log assignment inserted to database (INFO)
 */
async function logAssignmentInsertedToDatabase(options) {
    const { assignmentId, assetId, deptId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Assignment inserted to database successfully`,
        logLevel: 'INFO',
        requestData: { 
            assignment_id: assignmentId,
            asset_id: assetId,
            dept_id: deptId
        },
        responseData: { 
            inserted: true,
            rows_affected: 1
        },
        duration: null,
        userId
    });
}

/**
 * Log updating asset status (INFO)
 */
async function logUpdatingAssetStatus(options) {
    const { assetId, newStatus, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Updating asset status to ${newStatus}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            new_status: newStatus,
            query: 'UPDATE tblAssets SET current_status'
        },
        responseData: { status: 'updating' },
        duration: null,
        userId
    });
}

/**
 * Log asset status updated (INFO)
 */
async function logAssetStatusUpdated(options) {
    const { assetId, newStatus, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Asset status updated successfully to ${newStatus}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            new_status: newStatus
        },
        responseData: { 
            updated: true,
            status: newStatus
        },
        duration: null,
        userId
    });
}

// ==================== GENERIC LOGGING HELPERS ====================

/**
 * Generic API call logger (INFO)
 */
async function logApiCall(options) {
    const { operation, method, url, requestData, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'AssetAssignmentController',
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
        appId: APP_ID,
        eventType: 'ASSIGNMENT_OPERATION',
        module: 'AssetAssignmentController',
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
        appId: APP_ID,
        eventType: 'ASSIGNMENT_OPERATION',
        module: 'AssetAssignmentController',
        message: `ERROR: ${operation} failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData,
        responseData: { error: error.message, code: error.code },
        duration,
        userId
    });
}

// ==================== INFO LEVEL EVENTS ====================

/**
 * Log department assignment initiated (INFO)
 */
async function logDeptAssignmentInitiated(options) {
    const { assetId, deptId, orgId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ASSIGNMENT_INITIATED',
        module: 'AssetAssignmentController',
        message: `INFO: Asset assignment to department initiated - Asset: ${assetId}, Dept: ${deptId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId,
            org_id: orgId
        },
        responseData: { status: 'initiated' },
        duration: null,
        userId
    });
}

/**
 * Log department assignment successful (INFO)
 */
async function logDeptAssignmentSuccess(options) {
    const { assetId, deptId, assignmentId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ASSIGNMENT_SUCCESS',
        module: 'AssetAssignmentController',
        message: `INFO: Asset assigned to department successfully - Asset: ${assetId}, Dept: ${deptId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId,
            assignment_id: assignmentId
        },
        responseData: { 
            success: true,
            assignment_created: true,
            assignment_id: assignmentId
        },
        duration,
        userId
    });
}

/**
 * Log department unassignment initiated (INFO)
 */
async function logDeptUnassignmentInitiated(options) {
    const { assetId, deptId, assignmentId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'UNASSIGNMENT_INITIATED',
        module: 'AssetAssignmentController',
        message: `INFO: Asset unassignment from department initiated - Asset: ${assetId}, Dept: ${deptId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId,
            assignment_id: assignmentId
        },
        responseData: { status: 'initiated' },
        duration: null,
        userId
    });
}

/**
 * Log department unassignment successful (INFO)
 */
async function logDeptUnassignmentSuccess(options) {
    const { assetId, deptId, assignmentId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'UNASSIGNMENT_SUCCESS',
        module: 'AssetAssignmentController',
        message: `INFO: Asset unassigned from department successfully - Asset: ${assetId}, Dept: ${deptId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId,
            assignment_id: assignmentId
        },
        responseData: { 
            success: true,
            unassignment_complete: true
        },
        duration,
        userId
    });
}

/**
 * Log department selection API called (INFO)
 */
async function logDeptSelectionApiCalled(options) {
    const { method, url, deptId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'AssetAssignmentController',
        message: `INFO: ${method} ${url} - Department assignments retrieval API called`,
        logLevel: 'INFO',
        requestData: { 
            method,
            url,
            dept_id: deptId,
            operation: 'getDepartmentAssignments'
        },
        responseData: { status: 'Request received, fetching assignments' },
        duration: null,
        userId
    });
}

/**
 * Log querying department assignments from database (INFO)
 */
async function logQueryingDeptAssignments(options) {
    const { deptId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Querying assignments for department ${deptId}`,
        logLevel: 'INFO',
        requestData: { 
            dept_id: deptId,
            query: 'getDepartmentWiseAssetAssignments'
        },
        responseData: { status: 'Executing query' },
        duration: null,
        userId
    });
}

/**
 * Log department assignments retrieved (INFO)
 */
async function logDeptAssignmentsRetrieved(options) {
    const { deptId, count, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_RETRIEVED',
        module: 'AssetAssignmentController',
        message: `INFO: Retrieved ${count} assignments for department ${deptId}`,
        logLevel: 'INFO',
        requestData: { dept_id: deptId },
        responseData: { 
            count,
            has_assignments: count > 0
        },
        duration,
        userId
    });
}

/**
 * Log processing assignment data (INFO)
 */
async function logProcessingAssignmentData(options) {
    const { deptId, count, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_PROCESSING',
        module: 'AssetAssignmentController',
        message: `INFO: Processing ${count} assignment records for display`,
        logLevel: 'INFO',
        requestData: { 
            dept_id: deptId,
            record_count: count
        },
        responseData: { status: 'Formatting data for response' },
        duration: null,
        userId
    });
}

/**
 * Log asset type selection (INFO)
 */
async function logAssetTypeSelected(options) {
    const { assetTypeId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ASSET_TYPE_SELECTED',
        module: 'AssetSelection',
        message: `INFO: Asset type selected - Type: ${assetTypeId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_type_id: assetTypeId,
            action: 'asset_type_selection'
        },
        responseData: { asset_type_selected: true },
        duration: null,
        userId
    });
}

/**
 * Log asset type filtering (INFO)
 */
async function logAssetTypeFiltering(options) {
    const { deptId, assetTypeId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'FILTER_APPLIED',
        module: 'AssetSelection',
        message: `INFO: Fetching assets for asset type ${assetTypeId}`,
        logLevel: 'INFO',
        requestData: { 
            dept_id: deptId,
            asset_type_id: assetTypeId,
            filter_type: 'asset_type'
        },
        responseData: { filter_active: true },
        duration: null,
        userId
    });
}

/**
 * Log available assets viewed (INFO)
 */
async function logAvailableAssetsViewed(options) {
    const { deptId, assetCount, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ASSETS_VIEW',
        module: 'AssetSelection',
        message: `INFO: Viewed ${assetCount} available assets for department assignment`,
        logLevel: 'INFO',
        requestData: { dept_id: deptId },
        responseData: { 
            asset_count: assetCount,
            has_assets: assetCount > 0
        },
        duration,
        userId
    });
}

/**
 * Log assignment history viewed (INFO)
 */
async function logAssignmentHistoryViewed(options) {
    const { deptId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'HISTORY_VIEW',
        module: 'AssetAssignmentHistory',
        message: `INFO: Assignment history viewed for department ${deptId}`,
        logLevel: 'INFO',
        requestData: { dept_id: deptId },
        responseData: { history_accessed: true },
        duration,
        userId
    });
}

// ==================== WARNING LEVEL EVENTS ====================

/**
 * Log missing required parameters (WARNING)
 */
async function logMissingParameters(options) {
    const { operation, missingParams, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION_ERROR',
        module: 'AssetAssignmentController',
        message: `WARNING: ${operation} - Missing required parameters`,
        logLevel: 'WARNING',
        requestData: { operation },
        responseData: { 
            missing_parameters: missingParams,
            validation_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log invalid department (WARNING)
 */
async function logInvalidDepartment(options) {
    const { deptId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION_ERROR',
        module: 'AssetAssignmentController',
        message: `WARNING: Invalid department ID - ${deptId}`,
        logLevel: 'WARNING',
        requestData: { dept_id: deptId },
        responseData: { 
            error: 'Department not found',
            validation_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log invalid asset for department assignment (WARNING)
 */
async function logInvalidAssetForDept(options) {
    const { assetId, reason, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION_ERROR',
        module: 'AssetAssignmentController',
        message: `WARNING: Asset cannot be assigned to department - ${reason}`,
        logLevel: 'WARNING',
        requestData: { asset_id: assetId },
        responseData: { 
            error: reason,
            validation_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log duplicate assignment attempt (WARNING)
 */
async function logDuplicateAssignment(options) {
    const { assetId, deptId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DUPLICATE_ASSIGNMENT',
        module: 'AssetAssignmentController',
        message: `WARNING: Asset already assigned to department - Asset: ${assetId}, Dept: ${deptId}`,
        logLevel: 'WARNING',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId
        },
        responseData: { 
            error: 'Asset already assigned',
            duplicate_detected: true
        },
        duration,
        userId
    });
}

/**
 * Log unauthorized access (WARNING)
 */
async function logUnauthorizedAccess(options) {
    const { operation, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'UNAUTHORIZED_ACCESS',
        module: 'AssetAssignmentController',
        message: `WARNING: Unauthorized access attempt - ${operation}`,
        logLevel: 'WARNING',
        requestData: { operation },
        responseData: { 
            error: 'User not authenticated or insufficient permissions',
            access_denied: true
        },
        duration,
        userId: userId || null
    });
}

/**
 * Log no assets available for assignment (WARNING)
 */
async function logNoAssetsAvailable(options) {
    const { deptId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'NO_ASSETS',
        module: 'AssetSelection',
        message: `WARNING: No assets available for department assignment - Dept: ${deptId}`,
        logLevel: 'WARNING',
        requestData: { dept_id: deptId },
        responseData: { 
            asset_count: 0,
            no_assets_available: true
        },
        duration,
        userId
    });
}

// ==================== ERROR LEVEL EVENTS ====================

/**
 * Log assignment error (ERROR)
 */
async function logAssignmentError(options) {
    const { assetId, deptId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ASSIGNMENT_ERROR',
        module: 'AssetAssignmentController',
        message: `ERROR: Failed to assign asset to department - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId
        },
        responseData: { 
            error: error.message,
            error_code: error.code,
            assignment_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log unassignment error (ERROR)
 */
async function logUnassignmentError(options) {
    const { assetId, deptId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'UNASSIGNMENT_ERROR',
        module: 'AssetAssignmentController',
        message: `ERROR: Failed to unassign asset from department - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            asset_id: assetId,
            dept_id: deptId
        },
        responseData: { 
            error: error.message,
            error_code: error.code,
            unassignment_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log database query error (ERROR)
 */
async function logDatabaseQueryError(options) {
    const { operation, query, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATABASE_ERROR',
        module: 'AssetAssignmentController',
        message: `ERROR: Database query failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            operation,
            query_info: query || 'not provided'
        },
        responseData: { 
            error: error.message,
            error_code: error.code,
            sql_state: error.sqlState,
            query_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log assignment retrieval error (ERROR)
 */
async function logAssignmentRetrievalError(options) {
    const { deptId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'RETRIEVAL_ERROR',
        module: 'AssetAssignmentController',
        message: `ERROR: Failed to retrieve department assignments - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { dept_id: deptId },
        responseData: { 
            error: error.message,
            retrieval_failed: true
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
        appId: APP_ID,
        eventType: 'DB_CONNECTION_FAILURE',
        module: 'AssetAssignmentController',
        message: `CRITICAL: Database connection failed during ${operation}`,
        logLevel: 'CRITICAL',
        requestData: { operation },
        responseData: { 
            error: error.message,
            error_code: error.code,
            system_impact: 'high',
            connection_lost: true
        },
        duration,
        userId
    });
}

/**
 * Log data integrity violation (CRITICAL)
 */
async function logDataIntegrityViolation(options) {
    const { operation, details, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_INTEGRITY_VIOLATION',
        module: 'AssetAssignmentController',
        message: `CRITICAL: Data integrity violation during ${operation}`,
        logLevel: 'CRITICAL',
        requestData: { 
            operation,
            details
        },
        responseData: { 
            error: error.message,
            constraint: error.constraint,
            error_code: error.code,
            data_integrity_issue: true
        },
        duration,
        userId
    });
}

/**
 * Log system resource exhaustion (CRITICAL)
 */
async function logSystemResourceExhaustion(options) {
    const { operation, resource, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'RESOURCE_EXHAUSTION',
        module: 'AssetAssignmentController',
        message: `CRITICAL: System ${resource} exhausted during ${operation}`,
        logLevel: 'CRITICAL',
        requestData: { 
            operation,
            resource_type: resource
        },
        responseData: { 
            error: error.message,
            system_impact: 'critical',
            resource_exhausted: true
        },
        duration,
        userId
    });
}

module.exports = {
    // Detailed flow logging - Assignment
    logAssignmentApiCalled,
    logValidatingParameters,
    logCheckingAssetTypeAssignment,
    logAssetTypeValidated,
    logCheckingDepartmentExists,
    logDepartmentValidated,
    logCheckingExistingAssignment,
    logNoExistingAssignment,
    logGeneratingAssignmentId,
    logAssignmentIdGenerated,
    logInsertingAssignmentToDatabase,
    logAssignmentInsertedToDatabase,
    logUpdatingAssetStatus,
    logAssetStatusUpdated,
    // Detailed flow logging - Viewing
    logDeptSelectionApiCalled,
    logQueryingDeptAssignments,
    logProcessingAssignmentData,
    logAssetTypeSelected,
    // Generic helpers
    logApiCall,
    logOperationSuccess,
    logOperationError,
    // INFO
    logDeptAssignmentInitiated,
    logDeptAssignmentSuccess,
    logDeptUnassignmentInitiated,
    logDeptUnassignmentSuccess,
    logDeptAssignmentsRetrieved,
    logAssetTypeFiltering,
    logAvailableAssetsViewed,
    logAssignmentHistoryViewed,
    // WARNING
    logMissingParameters,
    logInvalidDepartment,
    logInvalidAssetForDept,
    logDuplicateAssignment,
    logUnauthorizedAccess,
    logNoAssetsAvailable,
    // ERROR
    logAssignmentError,
    logUnassignmentError,
    logDatabaseQueryError,
    logAssignmentRetrievalError,
    // CRITICAL
    logDatabaseConnectionFailure,
    logDataIntegrityViolation,
    logSystemResourceExhaustion
};

