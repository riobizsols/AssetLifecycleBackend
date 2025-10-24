/**
 * Event Logger for Serial Number Print (SERIALNUMBERPRINT)
 * 
 * This module handles event logging for serial number print operations.
 * Logs are written to: events_SERIALNUMBERPRINT_YYYY-MM-DD.csv
 * 
 * Operations tracked:
 * - Fetching print queue
 * - Adding items to print queue
 * - Updating print status
 * - Deleting from print queue
 * - Print operations
 * - Printer management
 * 
 * Log Levels:
 * - INFO: Normal operations (fetch, add, update, print)
 * - WARNING: Validation failures, missing parameters, duplicate entries
 * - ERROR: Operation failures, database errors
 * - CRITICAL: System-level failures, data integrity issues
 */

const eventLogger = require('../services/eventLogger');

const APP_ID = 'SERIALNUMBERPRINT';

// ==================== DETAILED FLOW LOGGING ====================

/**
 * Log print queue fetch API called (INFO)
 */
async function logPrintQueueFetchApiCalled(options) {
    const { method, url, status, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'AssetSerialPrintController',
        message: `INFO: ${method} ${url} - Print queue fetch API called`,
        logLevel: 'INFO',
        requestData: { 
            method, 
            url,
            status_filter: status || 'all',
            operation: 'fetchPrintQueue'
        },
        responseData: { status: 'Request received, fetching print queue' },
        duration: null,
        userId
    });
}

/**
 * Log querying print queue from database (INFO)
 */
async function logQueryingPrintQueue(options) {
    const { status, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetSerialPrintController',
        message: `INFO: Querying print queue from database`,
        logLevel: 'INFO',
        requestData: { 
            status_filter: status || 'all',
            query: 'getPrintQueueByStatus'
        },
        responseData: { status: 'Executing query' },
        duration: null,
        userId
    });
}

/**
 * Log print queue retrieved (INFO)
 */
async function logPrintQueueRetrieved(options) {
    const { count, status, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DATA_RETRIEVED',
        module: 'AssetSerialPrintController',
        message: `INFO: Retrieved ${count} print queue items`,
        logLevel: 'INFO',
        requestData: { status_filter: status || 'all' },
        responseData: { 
            count,
            has_items: count > 0
        },
        duration,
        userId
    });
}

/**
 * Log print queue item selection (INFO)
 */
async function logPrintQueueItemSelected(options) {
    const { psnqId, serialNumber, assetId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ITEM_SELECTED',
        module: 'SerialNumberPrint',
        message: `INFO: Print queue item selected - Serial: ${serialNumber}`,
        logLevel: 'INFO',
        requestData: { 
            psnq_id: psnqId,
            serial_number: serialNumber,
            asset_id: assetId
        },
        responseData: { item_selected: true },
        duration: null,
        userId
    });
}

/**
 * Log printer selection (INFO)
 */
async function logPrinterSelected(options) {
    const { printerId, printerName, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'PRINTER_SELECTED',
        module: 'SerialNumberPrint',
        message: `INFO: Printer selected - ${printerName}`,
        logLevel: 'INFO',
        requestData: { 
            printer_id: printerId,
            printer_name: printerName
        },
        responseData: { printer_selected: true },
        duration: null,
        userId
    });
}

/**
 * Log template selection (INFO)
 */
async function logTemplateSelected(options) {
    const { templateId, templateName, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'TEMPLATE_SELECTED',
        module: 'SerialNumberPrint',
        message: `INFO: Label template selected - ${templateName}`,
        logLevel: 'INFO',
        requestData: { 
            template_id: templateId,
            template_name: templateName
        },
        responseData: { template_selected: true },
        duration: null,
        userId
    });
}

/**
 * Log print initiated (INFO)
 */
async function logPrintInitiated(options) {
    const { psnqId, serialNumber, printerId, templateId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'PRINT_INITIATED',
        module: 'SerialNumberPrint',
        message: `INFO: Print initiated for serial: ${serialNumber}`,
        logLevel: 'INFO',
        requestData: { 
            psnq_id: psnqId,
            serial_number: serialNumber,
            printer_id: printerId,
            template_id: templateId
        },
        responseData: { status: 'Print job initiated' },
        duration: null,
        userId
    });
}

/**
 * Log generating PDF (INFO)
 */
async function logGeneratingPDF(options) {
    const { serialNumber, templateName, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'PDF_GENERATION',
        module: 'SerialNumberPrint',
        message: `INFO: Generating PDF for serial: ${serialNumber}`,
        logLevel: 'INFO',
        requestData: { 
            serial_number: serialNumber,
            template_name: templateName
        },
        responseData: { status: 'Generating PDF document' },
        duration: null,
        userId
    });
}

/**
 * Log PDF generated successfully (INFO)
 */
async function logPDFGenerated(options) {
    const { serialNumber, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'PDF_GENERATION',
        module: 'SerialNumberPrint',
        message: `INFO: PDF generated successfully for serial: ${serialNumber}`,
        logLevel: 'INFO',
        requestData: { serial_number: serialNumber },
        responseData: { 
            pdf_generated: true,
            ready_for_print: true
        },
        duration,
        userId
    });
}

/**
 * Log print job sent (INFO)
 */
async function logPrintJobSent(options) {
    const { psnqId, serialNumber, printerId, printerName, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'PRINT_SUCCESS',
        module: 'SerialNumberPrint',
        message: `INFO: Print job sent successfully - Serial: ${serialNumber}, Printer: ${printerName}`,
        logLevel: 'INFO',
        requestData: { 
            psnq_id: psnqId,
            serial_number: serialNumber,
            printer_id: printerId,
            printer_name: printerName
        },
        responseData: { 
            success: true,
            print_job_sent: true
        },
        duration,
        userId
    });
}

/**
 * Log status update API called (INFO)
 */
async function logStatusUpdateApiCalled(options) {
    const { method, url, psnqId, newStatus, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'API_CALL',
        module: 'AssetSerialPrintController',
        message: `INFO: ${method} ${url} - Status update API called`,
        logLevel: 'INFO',
        requestData: { 
            method, 
            url,
            psnq_id: psnqId,
            new_status: newStatus
        },
        responseData: { status: 'Request received, updating status' },
        duration: null,
        userId
    });
}

/**
 * Log validating status update (INFO)
 */
async function logValidatingStatusUpdate(options) {
    const { psnqId, oldStatus, newStatus, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION',
        module: 'AssetSerialPrintController',
        message: `INFO: Validating status update - From: ${oldStatus} To: ${newStatus}`,
        logLevel: 'INFO',
        requestData: { 
            psnq_id: psnqId,
            old_status: oldStatus,
            new_status: newStatus
        },
        responseData: { status: 'Validating status transition' },
        duration: null,
        userId
    });
}

/**
 * Log updating status in database (INFO)
 */
async function logUpdatingStatusInDatabase(options) {
    const { psnqId, newStatus, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetSerialPrintController',
        message: `INFO: Updating print status in database`,
        logLevel: 'INFO',
        requestData: { 
            psnq_id: psnqId,
            new_status: newStatus,
            query: 'UPDATE tblPrintSerialNoQueue'
        },
        responseData: { status: 'Executing UPDATE query' },
        duration: null,
        userId
    });
}

/**
 * Log status updated successfully (INFO)
 */
async function logStatusUpdated(options) {
    const { psnqId, serialNumber, newStatus, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'STATUS_UPDATE_SUCCESS',
        module: 'AssetSerialPrintController',
        message: `INFO: Print status updated successfully - Serial: ${serialNumber}, Status: ${newStatus}`,
        logLevel: 'INFO',
        requestData: { 
            psnq_id: psnqId,
            serial_number: serialNumber,
            new_status: newStatus
        },
        responseData: { 
            success: true,
            status_updated: true
        },
        duration,
        userId
    });
}

/**
 * Log add to print queue initiated (INFO)
 */
async function logAddToPrintQueueInitiated(options) {
    const { serialNumber, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ADD_TO_QUEUE',
        module: 'AssetSerialPrintController',
        message: `INFO: Adding serial number to print queue - ${serialNumber}`,
        logLevel: 'INFO',
        requestData: { 
            serial_number: serialNumber,
            operation: 'addToPrintQueue'
        },
        responseData: { status: 'Processing request' },
        duration: null,
        userId
    });
}

/**
 * Log inserting to print queue (INFO)
 */
async function logInsertingToPrintQueue(options) {
    const { serialNumber, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_QUERY',
        module: 'AssetSerialPrintController',
        message: `INFO: Inserting serial number to print queue`,
        logLevel: 'INFO',
        requestData: { 
            serial_number: serialNumber,
            query: 'INSERT INTO tblPrintSerialNoQueue'
        },
        responseData: { status: 'Executing INSERT query' },
        duration: null,
        userId
    });
}

/**
 * Log added to print queue successfully (INFO)
 */
async function logAddedToPrintQueue(options) {
    const { psnqId, serialNumber, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'QUEUE_ADD_SUCCESS',
        module: 'AssetSerialPrintController',
        message: `INFO: Serial number added to print queue successfully - ${serialNumber}`,
        logLevel: 'INFO',
        requestData: { 
            psnq_id: psnqId,
            serial_number: serialNumber
        },
        responseData: { 
            success: true,
            added_to_queue: true
        },
        duration,
        userId
    });
}

/**
 * Log delete from print queue initiated (INFO)
 */
async function logDeleteFromQueueInitiated(options) {
    const { psnqId, userId } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DELETE_INITIATED',
        module: 'AssetSerialPrintController',
        message: `INFO: Delete from print queue initiated - ID: ${psnqId}`,
        logLevel: 'INFO',
        requestData: { psnq_id: psnqId },
        responseData: { status: 'Processing delete request' },
        duration: null,
        userId
    });
}

/**
 * Log deleted from print queue (INFO)
 */
async function logDeletedFromQueue(options) {
    const { psnqId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DELETE_SUCCESS',
        module: 'AssetSerialPrintController',
        message: `INFO: Item deleted from print queue successfully - ID: ${psnqId}`,
        logLevel: 'INFO',
        requestData: { psnq_id: psnqId },
        responseData: { 
            success: true,
            deleted: true
        },
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
        module: 'AssetSerialPrintController',
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
 * Log duplicate serial number (WARNING)
 */
async function logDuplicateSerialNumber(options) {
    const { serialNumber, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DUPLICATE_ENTRY',
        module: 'AssetSerialPrintController',
        message: `WARNING: Serial number already exists in print queue - ${serialNumber}`,
        logLevel: 'WARNING',
        requestData: { serial_number: serialNumber },
        responseData: { 
            error: 'Duplicate serial number',
            duplicate_detected: true
        },
        duration,
        userId
    });
}

/**
 * Log print queue item not found (WARNING)
 */
async function logPrintQueueItemNotFound(options) {
    const { psnqId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'ITEM_NOT_FOUND',
        module: 'AssetSerialPrintController',
        message: `WARNING: Print queue item not found - ID: ${psnqId}`,
        logLevel: 'WARNING',
        requestData: { psnq_id: psnqId },
        responseData: { 
            error: 'Item not found',
            item_exists: false
        },
        duration,
        userId
    });
}

/**
 * Log invalid status transition (WARNING)
 */
async function logInvalidStatusTransition(options) {
    const { psnqId, oldStatus, newStatus, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'VALIDATION_ERROR',
        module: 'AssetSerialPrintController',
        message: `WARNING: Invalid status transition - From: ${oldStatus} To: ${newStatus}`,
        logLevel: 'WARNING',
        requestData: { 
            psnq_id: psnqId,
            old_status: oldStatus,
            new_status: newStatus
        },
        responseData: { 
            error: 'Invalid status transition',
            validation_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log no printers available (WARNING)
 */
async function logNoPrintersAvailable(options) {
    const { userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'NO_PRINTERS',
        module: 'SerialNumberPrint',
        message: `WARNING: No printers available for printing`,
        logLevel: 'WARNING',
        requestData: { operation: 'fetchPrinters' },
        responseData: { 
            printer_count: 0,
            no_printers_available: true
        },
        duration,
        userId
    });
}

/**
 * Log empty print queue (WARNING)
 */
async function logEmptyPrintQueue(options) {
    const { status, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'EMPTY_QUEUE',
        module: 'AssetSerialPrintController',
        message: `WARNING: No items found in print queue`,
        logLevel: 'WARNING',
        requestData: { status_filter: status || 'all' },
        responseData: { 
            count: 0,
            queue_empty: true
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
        module: 'AssetSerialPrintController',
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

// ==================== ERROR LEVEL EVENTS ====================

/**
 * Log print queue fetch error (ERROR)
 */
async function logPrintQueueFetchError(options) {
    const { status, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'FETCH_ERROR',
        module: 'AssetSerialPrintController',
        message: `ERROR: Failed to fetch print queue - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { status_filter: status || 'all' },
        responseData: { 
            error: error.message,
            error_code: error.code,
            fetch_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log add to queue error (ERROR)
 */
async function logAddToQueueError(options) {
    const { serialNumber, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'QUEUE_ADD_ERROR',
        module: 'AssetSerialPrintController',
        message: `ERROR: Failed to add serial number to print queue - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { serial_number: serialNumber },
        responseData: { 
            error: error.message,
            error_code: error.code,
            add_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log status update error (ERROR)
 */
async function logStatusUpdateError(options) {
    const { psnqId, newStatus, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'STATUS_UPDATE_ERROR',
        module: 'AssetSerialPrintController',
        message: `ERROR: Failed to update print status - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            psnq_id: psnqId,
            new_status: newStatus
        },
        responseData: { 
            error: error.message,
            error_code: error.code,
            update_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log delete error (ERROR)
 */
async function logDeleteError(options) {
    const { psnqId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DELETE_ERROR',
        module: 'AssetSerialPrintController',
        message: `ERROR: Failed to delete from print queue - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { psnq_id: psnqId },
        responseData: { 
            error: error.message,
            error_code: error.code,
            delete_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log print job error (ERROR)
 */
async function logPrintJobError(options) {
    const { serialNumber, printerId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'PRINT_ERROR',
        module: 'SerialNumberPrint',
        message: `ERROR: Print job failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            serial_number: serialNumber,
            printer_id: printerId
        },
        responseData: { 
            error: error.message,
            print_failed: true
        },
        duration,
        userId
    });
}

/**
 * Log PDF generation error (ERROR)
 */
async function logPDFGenerationError(options) {
    const { serialNumber, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'PDF_GENERATION_ERROR',
        module: 'SerialNumberPrint',
        message: `ERROR: PDF generation failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { serial_number: serialNumber },
        responseData: { 
            error: error.message,
            pdf_generation_failed: true
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
        module: 'AssetSerialPrintController',
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

// ==================== CRITICAL LEVEL EVENTS ====================

/**
 * Log database connection failure (CRITICAL)
 */
async function logDatabaseConnectionFailure(options) {
    const { operation, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'DB_CONNECTION_FAILURE',
        module: 'AssetSerialPrintController',
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
        module: 'AssetSerialPrintController',
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
 * Log printer system failure (CRITICAL)
 */
async function logPrinterSystemFailure(options) {
    const { printerId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'PRINTER_FAILURE',
        module: 'SerialNumberPrint',
        message: `CRITICAL: Printer system failure - ${error.message}`,
        logLevel: 'CRITICAL',
        requestData: { printer_id: printerId },
        responseData: { 
            error: error.message,
            system_impact: 'critical',
            printer_offline: true
        },
        duration,
        userId
    });
}

/**
 * Log print queue corruption (CRITICAL)
 */
async function logPrintQueueCorruption(options) {
    const { details, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: APP_ID,
        eventType: 'QUEUE_CORRUPTION',
        module: 'AssetSerialPrintController',
        message: `CRITICAL: Print queue data corruption detected`,
        logLevel: 'CRITICAL',
        requestData: { corruption_details: details },
        responseData: { 
            error: error?.message || 'Data corruption detected',
            data_integrity_compromised: true,
            immediate_action_required: true
        },
        duration,
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
        module: 'AssetSerialPrintController',
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
        eventType: 'PRINT_OPERATION',
        module: 'AssetSerialPrintController',
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
        eventType: 'PRINT_OPERATION',
        module: 'AssetSerialPrintController',
        message: `ERROR: ${operation} failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData,
        responseData: { error: error.message, code: error.code },
        duration,
        userId
    });
}

module.exports = {
    // Detailed flow logging
    logPrintQueueFetchApiCalled,
    logQueryingPrintQueue,
    logPrintQueueRetrieved,
    logPrintQueueItemSelected,
    logPrinterSelected,
    logTemplateSelected,
    logPrintInitiated,
    logGeneratingPDF,
    logPDFGenerated,
    logPrintJobSent,
    logStatusUpdateApiCalled,
    logValidatingStatusUpdate,
    logUpdatingStatusInDatabase,
    logStatusUpdated,
    logAddToPrintQueueInitiated,
    logInsertingToPrintQueue,
    logAddedToPrintQueue,
    logDeleteFromQueueInitiated,
    logDeletedFromQueue,
    // Generic helpers
    logApiCall,
    logOperationSuccess,
    logOperationError,
    // WARNING
    logMissingParameters,
    logDuplicateSerialNumber,
    logPrintQueueItemNotFound,
    logInvalidStatusTransition,
    logNoPrintersAvailable,
    logEmptyPrintQueue,
    logUnauthorizedAccess,
    // ERROR
    logPrintQueueFetchError,
    logAddToQueueError,
    logStatusUpdateError,
    logDeleteError,
    logPrintJobError,
    logPDFGenerationError,
    logDatabaseQueryError,
    // CRITICAL
    logDatabaseConnectionFailure,
    logDataIntegrityViolation,
    logPrinterSystemFailure,
    logPrintQueueCorruption
};

