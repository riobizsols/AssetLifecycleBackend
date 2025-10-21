/**
 * Event Logger for All Report Screens
 * 
 * This module handles event logging for all report-related operations.
 * Each report screen gets its own CSV file based on app_id:
 * 
 * - ASSETLIFECYCLEREPORT → events_ASSETLIFECYCLEREPORT_YYYY-MM-DD.csv
 * - ASSETREPORT → events_ASSETREPORT_YYYY-MM-DD.csv
 * - MAINTENANCEHISTORY → events_MAINTENANCEHISTORY_YYYY-MM-DD.csv
 * - ASSETVALUATION → events_ASSETVALUATION_YYYY-MM-DD.csv
 * - ASSETWORKFLOWHISTORY → events_ASSETWORKFLOWHISTORY_YYYY-MM-DD.csv
 * - BREAKDOWNHISTORY → events_BREAKDOWNHISTORY_YYYY-MM-DD.csv
 * 
 * Log Levels:
 * - INFO: Normal operations (report generation, data retrieval)
 * - WARNING: Missing parameters, validation failures, no data found
 * - ERROR: Report generation failures, database errors
 * - CRITICAL: System-level failures, data integrity issues
 */

const eventLogger = require('../services/eventLogger');

// ==================== GENERIC LOGGING HELPERS ====================

/**
 * Generic API call logger (INFO)
 * @param {string} appId - Report screen app_id (ASSETLIFECYCLEREPORT, etc.)
 */
async function logReportApiCall(options) {
    const { appId, operation, method, url, requestData, userId } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'API_CALL',
        module: 'ReportController',
        message: `INFO: ${method} ${url} - ${operation}`,
        logLevel: 'INFO',
        requestData: { operation, method, url, ...requestData },
        responseData: { status: 'processing' },
        duration: null,
        userId
    });
}

/**
 * Generic report generation success (INFO)
 */
async function logReportGenerationSuccess(options) {
    const { appId, operation, requestData, responseData, duration, userId } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'REPORT_GENERATED',
        module: 'ReportController',
        message: `INFO: ${operation} - Report generated successfully`,
        logLevel: 'INFO',
        requestData,
        responseData: { success: true, ...responseData },
        duration,
        userId
    });
}

/**
 * Generic report error (ERROR)
 */
async function logReportError(options) {
    const { appId, operation, requestData, error, duration, userId } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'REPORT_ERROR',
        module: 'ReportController',
        message: `ERROR: ${operation} failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData,
        responseData: { 
            error: error.message, 
            code: error.code,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        duration,
        userId
    });
}

// ==================== INFO LEVEL EVENTS ====================

/**
 * Log report data retrieval started (INFO)
 */
async function logReportDataRetrieval(options) {
    const { appId, reportType, filters, userId } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'DATA_RETRIEVAL',
        module: 'ReportController',
        message: `INFO: Retrieving ${reportType} report data`,
        logLevel: 'INFO',
        requestData: { 
            report_type: reportType,
            filters: filters || 'none',
            filter_count: filters ? Object.keys(filters).length : 0
        },
        responseData: { status: 'fetching' },
        duration: null,
        userId
    });
}

/**
 * Log report data retrieved successfully (INFO)
 */
async function logReportDataRetrieved(options) {
    const { appId, reportType, recordCount, filters, duration, userId } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'DATA_RETRIEVED',
        module: 'ReportController',
        message: `INFO: Retrieved ${recordCount} records for ${reportType} report`,
        logLevel: 'INFO',
        requestData: { 
            report_type: reportType,
            filters: filters || 'none'
        },
        responseData: { 
            success: true,
            record_count: recordCount,
            has_data: recordCount > 0
        },
        duration,
        userId
    });
}

/**
 * Log report filters applied (INFO)
 */
async function logReportFiltersApplied(options) {
    const { appId, reportType, filters, userId } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'FILTERS_APPLIED',
        module: 'ReportController',
        message: `INFO: Filters applied to ${reportType} report`,
        logLevel: 'INFO',
        requestData: { 
            report_type: reportType,
            filter_keys: Object.keys(filters),
            filter_count: Object.keys(filters).length,
            filters
        },
        responseData: { filters_valid: true },
        duration: null,
        userId
    });
}

/**
 * Log report export initiated (INFO)
 */
async function logReportExport(options) {
    const { appId, reportType, exportFormat, recordCount, userId } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'REPORT_EXPORT',
        module: 'ReportController',
        message: `INFO: Exporting ${reportType} report as ${exportFormat}`,
        logLevel: 'INFO',
        requestData: { 
            report_type: reportType,
            export_format: exportFormat,
            record_count: recordCount
        },
        responseData: { export_initiated: true },
        duration: null,
        userId
    });
}

// ==================== WARNING LEVEL EVENTS ====================

/**
 * Log missing required parameters (WARNING)
 */
async function logMissingParameters(options) {
    const { appId, operation, missingParams, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'VALIDATION_ERROR',
        module: 'ReportController',
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
 * Log no data found for report (WARNING)
 */
async function logNoDataFound(options) {
    const { appId, reportType, filters, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'NO_DATA',
        module: 'ReportController',
        message: `WARNING: No data found for ${reportType} report`,
        logLevel: 'WARNING',
        requestData: { 
            report_type: reportType,
            filters: filters || 'none'
        },
        responseData: { 
            record_count: 0,
            has_data: false,
            reason: 'No matching records found'
        },
        duration,
        userId
    });
}

/**
 * Log invalid filter values (WARNING)
 */
async function logInvalidFilters(options) {
    const { appId, reportType, invalidFilters, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'INVALID_FILTERS',
        module: 'ReportController',
        message: `WARNING: Invalid filter values provided for ${reportType} report`,
        logLevel: 'WARNING',
        requestData: { 
            report_type: reportType,
            invalid_filters: invalidFilters
        },
        responseData: { 
            validation_failed: true,
            reason: 'Invalid filter format or values'
        },
        duration,
        userId
    });
}

/**
 * Log unauthorized access attempt (WARNING)
 */
async function logUnauthorizedReportAccess(options) {
    const { appId, reportType, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'UNAUTHORIZED_ACCESS',
        module: 'ReportController',
        message: `WARNING: Unauthorized access attempt to ${reportType} report`,
        logLevel: 'WARNING',
        requestData: { report_type: reportType },
        responseData: { 
            access_denied: true,
            reason: 'Insufficient permissions or missing organization ID'
        },
        duration,
        userId
    });
}

/**
 * Log large result set warning (WARNING)
 */
async function logLargeResultSet(options) {
    const { appId, reportType, recordCount, threshold, userId } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'LARGE_RESULT_SET',
        module: 'ReportController',
        message: `WARNING: ${reportType} report returned ${recordCount} records (threshold: ${threshold})`,
        logLevel: 'WARNING',
        requestData: { 
            report_type: reportType,
            record_count: recordCount,
            threshold
        },
        responseData: { 
            performance_warning: true,
            recommendation: 'Consider adding filters to reduce result set'
        },
        duration: null,
        userId
    });
}

// ==================== ERROR LEVEL EVENTS ====================

/**
 * Log report generation error (ERROR)
 */
async function logReportGenerationError(options) {
    const { appId, reportType, error, filters, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'GENERATION_ERROR',
        module: 'ReportController',
        message: `ERROR: Failed to generate ${reportType} report - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            report_type: reportType,
            filters: filters || 'none'
        },
        responseData: { 
            error: error.message,
            error_code: error.code,
            generation_failed: true,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        duration,
        userId
    });
}

/**
 * Log database query error (ERROR)
 */
async function logDatabaseQueryError(options) {
    const { appId, reportType, query, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'DATABASE_ERROR',
        module: 'ReportController',
        message: `ERROR: Database query failed for ${reportType} report - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            report_type: reportType,
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
 * Log data parsing error (ERROR)
 */
async function logDataParsingError(options) {
    const { appId, reportType, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'PARSING_ERROR',
        module: 'ReportController',
        message: `ERROR: Failed to parse ${reportType} report data - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { report_type: reportType },
        responseData: { 
            error: error.message,
            parsing_failed: true,
            reason: 'Invalid data format or structure'
        },
        duration,
        userId
    });
}

/**
 * Log export error (ERROR)
 */
async function logExportError(options) {
    const { appId, reportType, exportFormat, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'EXPORT_ERROR',
        module: 'ReportController',
        message: `ERROR: Failed to export ${reportType} report as ${exportFormat} - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            report_type: reportType,
            export_format: exportFormat
        },
        responseData: { 
            error: error.message,
            export_failed: true
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
    const { appId, reportType, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'DB_CONNECTION_FAILURE',
        module: 'ReportController',
        message: `CRITICAL: Database connection failed while generating ${reportType} report`,
        logLevel: 'CRITICAL',
        requestData: { report_type: reportType },
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
 * Log database constraint violation (CRITICAL)
 */
async function logDatabaseConstraintViolation(options) {
    const { appId, reportType, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'DB_CONSTRAINT_VIOLATION',
        module: 'ReportController',
        message: `CRITICAL: Database constraint violation in ${reportType} report`,
        logLevel: 'CRITICAL',
        requestData: { report_type: reportType },
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
    const { appId, reportType, resource, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'RESOURCE_EXHAUSTION',
        module: 'ReportController',
        message: `CRITICAL: System ${resource} exhausted while generating ${reportType} report`,
        logLevel: 'CRITICAL',
        requestData: { 
            report_type: reportType,
            resource_type: resource
        },
        responseData: { 
            error: error.message,
            system_impact: 'critical',
            resource_exhausted: true,
            recommendation: 'Reduce result set size or optimize query'
        },
        duration,
        userId
    });
}

/**
 * Log data corruption detected (CRITICAL)
 */
async function logDataCorruptionDetected(options) {
    const { appId, reportType, details, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId,
        eventType: 'DATA_CORRUPTION',
        module: 'ReportController',
        message: `CRITICAL: Data corruption detected in ${reportType} report`,
        logLevel: 'CRITICAL',
        requestData: { report_type: reportType },
        responseData: { 
            corruption_details: details,
            data_integrity_compromised: true,
            immediate_action_required: true
        },
        duration,
        userId
    });
}

module.exports = {
    // Generic helpers
    logReportApiCall,
    logReportGenerationSuccess,
    logReportError,
    // INFO
    logReportDataRetrieval,
    logReportDataRetrieved,
    logReportFiltersApplied,
    logReportExport,
    // WARNING
    logMissingParameters,
    logNoDataFound,
    logInvalidFilters,
    logUnauthorizedReportAccess,
    logLargeResultSet,
    // ERROR
    logReportGenerationError,
    logDatabaseQueryError,
    logDataParsingError,
    logExportError,
    // CRITICAL
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation,
    logSystemResourceExhaustion,
    logDataCorruptionDetected
};

