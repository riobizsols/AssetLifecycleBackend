/**
 * Event Logger for Employee Assignment (EMPASSIGNMENT)
 * 
 * This module handles event logging for employee-wise asset assignment operations.
 * Logs are written to: events_EMPASSIGNMENT_YYYY-MM-DD.csv
 * 
 * Operations tracked:
 * - Asset assignment to employees
 * - Asset unassignment from employees
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

const APP_ID = 'EMPASSIGNMENT';

// ==================== DETAILED FLOW LOGGING ====================

/**
 * Log assignment API called (INFO)
 */
async function logAssignmentApiCalled(options) {
    const { method, url, assetId, employeeIntId, deptId, orgId, userId, requestBody } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'AssetAssignmentController',
        message: `INFO: ${method} ${url} - Employee assignment API called`,
        logLevel: 'INFO',
        requestData: { 
            method, 
            url,
            asset_id: assetId,
            employee_int_id: employeeIntId,
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
    const { assetId, employeeIntId, deptId, orgId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'AssetAssignmentController',
        message: `INFO: Validating assignment parameters`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId,
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
 * Log asset type validated for employee (INFO)
 */
async function logAssetTypeValidated(options) {
    const { assetId, assignmentType, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'AssetAssignmentController',
        message: `INFO: Asset type validated for employee assignment - Type: ${assignmentType}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            assignment_type: assignmentType
        },
        responseData: { 
            valid: true,
            assignment_type_matches: assignmentType === 'User' || assignmentType === 'user'
        },
        duration: null,
        userId
    });
}

/**
 * Log checking employee exists (INFO)
 */
async function logCheckingEmployeeExists(options) {
    const { employeeIntId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Validating employee exists in database`,
        logLevel: 'INFO',
        requestData: { 
            employee_int_id: employeeIntId,
            query: 'checkEmployeeExists'
        },
        responseData: { status: 'querying database' },
        duration: null,
        userId
    });
}

/**
 * Log employee validated (INFO)
 */
async function logEmployeeValidated(options) {
    const { employeeIntId, employeeName, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'AssetAssignmentController',
        message: `INFO: Employee validated successfully - ${employeeName}`,
        logLevel: 'INFO',
        requestData: { employee_int_id: employeeIntId },
        responseData: { 
            valid: true,
            employee_exists: true,
            employee_name: employeeName
        },
        duration: null,
        userId
    });
}

/**
 * Log checking for existing assignment (INFO)
 */
async function logCheckingExistingAssignment(options) {
    const { assetId, employeeIntId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Checking for existing assignment`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId,
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
    const { assetId, employeeIntId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'AssetAssignmentController',
        message: `INFO: No existing assignment found - proceeding with assignment`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId
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
    const { assignmentId, assetId, employeeIntId, deptId, orgId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Inserting assignment to database`,
        logLevel: 'INFO',
        requestData: { 
            assignment_id: assignmentId,
            asset_id: assetId,
            employee_int_id: employeeIntId,
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
    const { assignmentId, assetId, employeeIntId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Assignment inserted to database successfully`,
        logLevel: 'INFO',
        requestData: { 
            assignment_id: assignmentId,
            asset_id: assetId,
            employee_int_id: employeeIntId
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
 * Log employee assignment initiated (INFO)
 */
async function logEmpAssignmentInitiated(options) {
    const { assetId, employeeIntId, deptId, orgId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ASSIGNMENT_INITIATED',
        module: 'AssetAssignmentController',
        message: `INFO: Asset assignment to employee initiated - Asset: ${assetId}, Employee: ${employeeIntId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId,
            dept_id: deptId,
            org_id: orgId
        },
        responseData: { status: 'initiated' },
        duration: null,
        userId
    });
}

/**
 * Log employee assignment successful (INFO)
 */
async function logEmpAssignmentSuccess(options) {
    const { assetId, employeeIntId, assignmentId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ASSIGNMENT_SUCCESS',
        module: 'AssetAssignmentController',
        message: `INFO: Asset assigned to employee successfully - Asset: ${assetId}, Employee: ${employeeIntId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId,
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
 * Log employee unassignment initiated (INFO)
 */
async function logEmpUnassignmentInitiated(options) {
    const { assetId, employeeIntId, assignmentId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'UNASSIGNMENT_INITIATED',
        module: 'AssetAssignmentController',
        message: `INFO: Asset unassignment from employee initiated - Asset: ${assetId}, Employee: ${employeeIntId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId,
            assignment_id: assignmentId
        },
        responseData: { status: 'initiated' },
        duration: null,
        userId
    });
}

/**
 * Log employee unassignment successful (INFO)
 */
async function logEmpUnassignmentSuccess(options) {
    const { assetId, employeeIntId, assignmentId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'UNASSIGNMENT_SUCCESS',
        module: 'AssetAssignmentController',
        message: `INFO: Asset unassigned from employee successfully - Asset: ${assetId}, Employee: ${employeeIntId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId,
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
 * Log employee selection API called (INFO)
 */
async function logEmpSelectionApiCalled(options) {
    const { method, url, employeeId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'AssetAssignmentController',
        message: `INFO: ${method} ${url} - Employee assignments retrieval API called`,
        logLevel: 'INFO',
        requestData: { 
            method,
            url,
            employee_id: employeeId,
            operation: 'getEmployeeAssignments'
        },
        responseData: { status: 'Request received, fetching assignments' },
        duration: null,
        userId
    });
}

/**
 * Log querying employee assignments from database (INFO)
 */
async function logQueryingEmpAssignments(options) {
    const { employeeId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetAssignmentController',
        message: `INFO: Querying assignments for employee ${employeeId}`,
        logLevel: 'INFO',
        requestData: { 
            employee_id: employeeId,
            query: 'getActiveAssetAssignmentsByEmployeeWithDetails'
        },
        responseData: { status: 'Executing query' },
        duration: null,
        userId
    });
}

/**
 * Log employee assignments retrieved (INFO)
 */
async function logEmpAssignmentsRetrieved(options) {
    const { employeeId, count, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_RETRIEVED',
        module: 'AssetAssignmentController',
        message: `INFO: Retrieved ${count} assignments for employee ${employeeId}`,
        logLevel: 'INFO',
        requestData: { employee_id: employeeId },
        responseData: { 
            count,
            has_assignments: count > 0
        },
        duration,
        userId
    });
}

/**
 * Log processing employee assignment data (INFO)
 */
async function logProcessingEmpAssignmentData(options) {
    const { employeeId, count, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_PROCESSING',
        module: 'AssetAssignmentController',
        message: `INFO: Processing ${count} assignment records for display`,
        logLevel: 'INFO',
        requestData: { 
            employee_id: employeeId,
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
    const { employeeIntId, assetTypeId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'FILTER_APPLIED',
        module: 'AssetSelection',
        message: `INFO: Fetching assets for asset type ${assetTypeId}`,
        logLevel: 'INFO',
        requestData: { 
            employee_int_id: employeeIntId,
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
    const { employeeIntId, assetCount, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ASSETS_VIEW',
        module: 'AssetSelection',
        message: `INFO: Viewed ${assetCount} available assets for employee assignment`,
        logLevel: 'INFO',
        requestData: { employee_int_id: employeeIntId },
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
    const { employeeIntId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'HISTORY_VIEW',
        module: 'AssetAssignmentHistory',
        message: `INFO: Assignment history viewed for employee ${employeeIntId}`,
        logLevel: 'INFO',
        requestData: { employee_int_id: employeeIntId },
        responseData: { history_accessed: true },
        duration,
        userId
    });
}

/**
 * Log department filter changed (INFO)
 */
async function logDepartmentFilterChanged(options) {
    const { deptId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'FILTER_APPLIED',
        module: 'EmployeeWiseAssetAssignment',
        message: `INFO: Department filter changed - Dept: ${deptId}`,
        logLevel: 'INFO',
        requestData: { 
            dept_id: deptId,
            filter_type: 'department'
        },
        responseData: { filter_active: true },
        duration: null,
        userId
    });
}

/**
 * Log employee selection (INFO)
 */
async function logEmployeeSelected(options) {
    const { employeeId, employeeIntId, deptId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'EMPLOYEE_SELECTED',
        module: 'EmployeeWiseAssetAssignment',
        message: `INFO: Employee selected - Employee: ${employeeId} (Int ID: ${employeeIntId})`,
        logLevel: 'INFO',
        requestData: { 
            employee_id: employeeId,
            employee_int_id: employeeIntId,
            dept_id: deptId
        },
        responseData: { employee_selected: true },
        duration: null,
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
 * Log invalid employee (WARNING)
 */
async function logInvalidEmployee(options) {
    const { employeeId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION_ERROR',
        module: 'AssetAssignmentController',
        message: `WARNING: Invalid employee ID - ${employeeId}`,
        logLevel: 'WARNING',
        requestData: { employee_id: employeeId },
        responseData: { 
            error: 'Employee not found',
            validation_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log invalid asset for employee assignment (WARNING)
 */
async function logInvalidAssetForEmployee(options) {
    const { assetId, reason, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION_ERROR',
        module: 'AssetAssignmentController',
        message: `WARNING: Asset cannot be assigned to employee - ${reason}`,
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
    const { assetId, employeeIntId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DUPLICATE_ASSIGNMENT',
        module: 'AssetAssignmentController',
        message: `WARNING: Asset already assigned to employee - Asset: ${assetId}, Employee: ${employeeIntId}`,
        logLevel: 'WARNING',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId
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
    const { employeeIntId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'NO_ASSETS',
        module: 'AssetSelection',
        message: `WARNING: No assets available for employee assignment - Employee: ${employeeIntId}`,
        logLevel: 'WARNING',
        requestData: { employee_int_id: employeeIntId },
        responseData: { 
            asset_count: 0,
            no_assets_available: true
        },
        duration,
        userId
    });
}

/**
 * Log missing employee internal ID (WARNING)
 */
async function logMissingEmployeeIntId(options) {
    const { employeeId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION_ERROR',
        module: 'AssetAssignmentController',
        message: `WARNING: Employee internal ID missing for employee ${employeeId}`,
        logLevel: 'WARNING',
        requestData: { employee_id: employeeId },
        responseData: { 
            error: 'Employee internal ID is required',
            validation_failed: true
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
    const { assetId, employeeIntId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ASSIGNMENT_ERROR',
        module: 'AssetAssignmentController',
        message: `ERROR: Failed to assign asset to employee - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId
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
    const { assetId, employeeIntId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'UNASSIGNMENT_ERROR',
        module: 'AssetAssignmentController',
        message: `ERROR: Failed to unassign asset from employee - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            asset_id: assetId,
            employee_int_id: employeeIntId
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
    const { employeeId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'RETRIEVAL_ERROR',
        module: 'AssetAssignmentController',
        message: `ERROR: Failed to retrieve employee assignments - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { employee_id: employeeId },
        responseData: { 
            error: error.message,
            retrieval_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log employee fetch error (ERROR)
 */
async function logEmployeeFetchError(options) {
    const { deptId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'EMPLOYEE_FETCH_ERROR',
        module: 'EmployeeWiseAssetAssignment',
        message: `ERROR: Failed to fetch employees for department - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { dept_id: deptId },
        responseData: { 
            error: error.message,
            fetch_failed: true
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
    logCheckingEmployeeExists,
    logEmployeeValidated,
    logCheckingExistingAssignment,
    logNoExistingAssignment,
    logGeneratingAssignmentId,
    logAssignmentIdGenerated,
    logInsertingAssignmentToDatabase,
    logAssignmentInsertedToDatabase,
    logUpdatingAssetStatus,
    logAssetStatusUpdated,
    // Detailed flow logging - Viewing
    logEmpSelectionApiCalled,
    logQueryingEmpAssignments,
    logProcessingEmpAssignmentData,
    logAssetTypeSelected,
    // Generic helpers
    logApiCall,
    logOperationSuccess,
    logOperationError,
    // INFO
    logEmpAssignmentInitiated,
    logEmpAssignmentSuccess,
    logEmpUnassignmentInitiated,
    logEmpUnassignmentSuccess,
    logEmpAssignmentsRetrieved,
    logAssetTypeFiltering,
    logAvailableAssetsViewed,
    logAssignmentHistoryViewed,
    logDepartmentFilterChanged,
    logEmployeeSelected,
    // WARNING
    logMissingParameters,
    logInvalidEmployee,
    logInvalidAssetForEmployee,
    logDuplicateAssignment,
    logUnauthorizedAccess,
    logNoAssetsAvailable,
    logMissingEmployeeIntId,
    // ERROR
    logAssignmentError,
    logUnassignmentError,
    logDatabaseQueryError,
    logAssignmentRetrievalError,
    logEmployeeFetchError,
    // CRITICAL
    logDatabaseConnectionFailure,
    logDataIntegrityViolation,
    logSystemResourceExhaustion
};

