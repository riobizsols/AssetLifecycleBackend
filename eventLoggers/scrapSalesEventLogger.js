const eventLogger = require('../services/eventLogger');

const APP_ID = 'SCRAPSALES';

// ============================================================================
// GENERIC LOGGING FUNCTIONS

// Generic API call logging
async function logApiCall(options) {
    const { operation, method, url, userId, requestData } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'API_CALL',
        module: 'ScrapSalesController',
        message: `INFO: ${operation} - ${method} ${url} API called`,
        requestData: JSON.stringify({
            method,
            url,
            operation,
            ...requestData
        }),
        responseData: JSON.stringify({
            status: 'Request received, processing...'
        }),
        userId: userId
    });
}

// Generic operation success logging
async function logOperationSuccess(options) {
    const { operation, userId, duration, resultData } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'OPERATION_SUCCESS',
        module: 'ScrapSalesController',
        message: `INFO: ${operation} completed successfully`,
        requestData: JSON.stringify({
            operation,
            userId: userId
        }),
        responseData: JSON.stringify({
            success: true,
            duration: duration,
            ...resultData
        }),
        duration: duration,
        userId: userId
    });
}

// Generic operation error logging
async function logOperationError(options) {
    const { operation, error, userId, duration, requestData } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'OPERATION_ERROR',
        module: 'ScrapSalesController',
        message: `ERROR: ${operation} failed - ${error.message}`,
        requestData: JSON.stringify({
            operation,
            userId: userId,
            ...requestData
        }),
        responseData: JSON.stringify({
            error: error.message,
            success: false
        }),
        duration: duration,
        userId: userId
    });
}

// ============================================================================
// DATA FLOW AND STORAGE LOGGING

// Log data preparation started
async function logDataPreparationStarted(options) {
    const { buyerName, totalValue, assetCount, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DATA_PREPARATION_STARTED',
        module: 'ScrapSalesController',
        message: `INFO: Data preparation started for scrap sale to buyer ${buyerName}`,
        requestData: JSON.stringify({
            operation: 'prepareScrapSaleData',
            buyer_name: buyerName,
            total_sale_value: totalValue,
            asset_count: assetCount
        }),
        responseData: JSON.stringify({
            status: 'Preparing sale data structure'
        }),
        userId: userId
    });
}

// Log data preparation completed
async function logDataPreparationCompleted(options) {
    const { headerData, assetDetails, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DATA_PREPARATION_COMPLETED',
        module: 'ScrapSalesController',
        message: `INFO: Sale data prepared successfully for buyer ${headerData.buyer_name}`,
        requestData: JSON.stringify({
            operation: 'prepareScrapSaleData',
            header_data: headerData,
            asset_details_count: assetDetails.length
        }),
        responseData: JSON.stringify({
            status: 'Data structure ready for database insertion',
            header_fields: Object.keys(headerData),
            asset_count: assetDetails.length
        }),
        userId: userId
    });
}

// Log database transaction started
async function logDatabaseTransactionStarted(options) {
    const { operation, tables, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DATABASE_TRANSACTION_STARTED',
        module: 'ScrapSalesController',
        message: `INFO: Database transaction started for ${operation}`,
        requestData: JSON.stringify({
            operation: operation,
            tables_to_update: tables
        }),
        responseData: JSON.stringify({
            status: 'Transaction initiated',
            tables: tables
        }),
        userId: userId
    });
}

// Log database transaction completed
async function logDatabaseTransactionCompleted(options) {
    const { operation, sshId, tablesUpdated, recordsCreated, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DATABASE_TRANSACTION_COMPLETED',
        module: 'ScrapSalesController',
        message: `INFO: Database transaction completed for ${operation} - SSH ID: ${sshId}`,
        requestData: JSON.stringify({
            operation: operation,
            ssh_id: sshId,
            tables_updated: tablesUpdated
        }),
        responseData: JSON.stringify({
            status: 'Transaction committed successfully',
            ssh_id: sshId,
            tables_updated: tablesUpdated,
            records_created: recordsCreated
        }),
        userId: userId
    });
}

// Log header table insertion
async function logHeaderTableInserted(options) {
    const { sshId, tableName, headerData, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'HEADER_TABLE_INSERTED',
        module: 'ScrapSalesController',
        message: `INFO: Header record inserted into ${tableName} - SSH ID: ${sshId}`,
        requestData: JSON.stringify({
            operation: 'insertHeaderRecord',
            table_name: tableName,
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            status: 'Header record created',
            table_name: tableName,
            ssh_id: sshId,
            buyer_name: headerData.buyer_name,
            total_sale_value: headerData.total_sale_value,
            created_on: headerData.created_on
        }),
        userId: userId
    });
}

// Log details table insertion
async function logDetailsTableInserted(options) {
    const { sshId, tableName, detailRecords, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DETAILS_TABLE_INSERTED',
        module: 'ScrapSalesController',
        message: `INFO: ${detailRecords.length} detail records inserted into ${tableName} - SSH ID: ${sshId}`,
        requestData: JSON.stringify({
            operation: 'insertDetailRecords',
            table_name: tableName,
            ssh_id: sshId,
            record_count: detailRecords.length
        }),
        responseData: JSON.stringify({
            status: 'Detail records created',
            table_name: tableName,
            ssh_id: sshId,
            records_created: detailRecords.length,
            detail_ids: detailRecords.map(record => record.ssd_id)
        }),
        userId: userId
    });
}

// Log asset status updates
async function logAssetStatusUpdated(options) {
    const { sshId, assetsUpdated, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSET_STATUS_UPDATED',
        module: 'ScrapSalesController',
        message: `INFO: Asset status updated for ${assetsUpdated.length} assets - SSH ID: ${sshId}`,
        requestData: JSON.stringify({
            operation: 'updateAssetStatus',
            ssh_id: sshId,
            asset_count: assetsUpdated.length
        }),
        responseData: JSON.stringify({
            status: 'Assets marked as sold',
            ssh_id: sshId,
            assets_updated: assetsUpdated.map(asset => ({
                asd_id: asset.asd_id,
                ssd_id: asset.ssd_id,
                sale_value: asset.sale_value
            }))
        }),
        userId: userId
    });
}

// ============================================================================
// DELETE OPERATION LOGGING

// Log delete scrap sale API called
async function logDeleteScrapSaleApiCalled(options) {
    const { method, url, userId, sshId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DELETE_SCRAP_SALE_API_CALLED',
        module: 'ScrapSalesController',
        message: `INFO: ${method} ${url} - Delete scrap sale API called for SSH ID: ${sshId}`,
        requestData: JSON.stringify({
            method,
            url,
            operation: 'deleteScrapSale',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            status: 'Request received, processing deletion'
        }),
        userId: userId
    });
}

// Log scrap sale deletion started
async function logScrapSaleDeletionStarted(options) {
    const { sshId, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_SALE_DELETION_STARTED',
        module: 'ScrapSalesController',
        message: `INFO: Scrap sale deletion started for SSH ID: ${sshId}`,
        requestData: JSON.stringify({
            operation: 'deleteScrapSale',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            status: 'Initiating deletion process'
        }),
        userId: userId
    });
}

// Log documents deletion
async function logDocumentsDeleted(options) {
    const { sshId, documentsDeleted, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DOCUMENTS_DELETED',
        module: 'ScrapSalesController',
        message: `INFO: ${documentsDeleted} documents deleted for SSH ID: ${sshId}`,
        requestData: JSON.stringify({
            operation: 'deleteDocuments',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            status: 'Documents deleted successfully',
            ssh_id: sshId,
            documents_deleted: documentsDeleted
        }),
        userId: userId
    });
}

// Log details deletion
async function logDetailsDeleted(options) {
    const { sshId, detailsDeleted, assetsAffected, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DETAILS_DELETED',
        module: 'ScrapSalesController',
        message: `INFO: ${detailsDeleted} detail records deleted for SSH ID: ${sshId}`,
        requestData: JSON.stringify({
            operation: 'deleteDetails',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            status: 'Detail records deleted successfully',
            ssh_id: sshId,
            details_deleted: detailsDeleted,
            assets_affected: assetsAffected
        }),
        userId: userId
    });
}

// Log header deletion
async function logHeaderDeleted(options) {
    const { sshId, headerDeleted, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'HEADER_DELETED',
        module: 'ScrapSalesController',
        message: `INFO: Header record deleted for SSH ID: ${sshId}`,
        requestData: JSON.stringify({
            operation: 'deleteHeader',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            status: 'Header record deleted successfully',
            ssh_id: sshId,
            header_deleted: headerDeleted
        }),
        userId: userId
    });
}

// Log scrap sale deletion completed
async function logScrapSaleDeleted(options) {
    const { sshId, totalRecordsDeleted, assetsAffected, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_SALE_DELETED',
        module: 'ScrapSalesController',
        message: `INFO: Scrap sale ${sshId} deleted successfully - ${totalRecordsDeleted} records removed`,
        requestData: JSON.stringify({
            operation: 'deleteScrapSale',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            status: 'Scrap sale deleted successfully',
            ssh_id: sshId,
            total_records_deleted: totalRecordsDeleted,
            assets_affected: assetsAffected
        }),
        duration: duration,
        userId: userId
    });
}

// Log scrap sale deletion error
async function logScrapSaleDeletionError(options) {
    const { sshId, error, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'SCRAP_SALE_DELETION_ERROR',
        module: 'ScrapSalesController',
        message: `ERROR: Failed to delete scrap sale ${sshId} - ${error.message}`,
        requestData: JSON.stringify({
            operation: 'deleteScrapSale',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            error: error.message,
            success: false
        }),
        duration: duration,
        userId: userId
    });
}

// Log scrap sale not found for deletion
async function logScrapSaleNotFoundForDeletion(options) {
    const { sshId, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'SCRAP_SALE_NOT_FOUND_FOR_DELETION',
        module: 'ScrapSalesController',
        message: `WARNING: Scrap sale ${sshId} not found for deletion`,
        requestData: JSON.stringify({
            operation: 'deleteScrapSale',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            status: 'Scrap sale not found',
            ssh_id: sshId
        }),
        userId: userId
    });
}

// ============================================================================
// SCRAP SALES SPECIFIC LOGGING

// Create Scrap Sale API
async function logCreateScrapSaleApiCalled(options) {
    const { method, url, userId, saleData } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CREATE_SCRAP_SALE_API_CALLED',
        module: 'ScrapSalesController',
        message: `INFO: POST ${url} - Create scrap sale API called`,
        requestData: JSON.stringify({
            method,
            url,
            operation: 'createScrapSale',
            buyer_name: saleData?.buyer_name,
            total_sale_value: saleData?.total_sale_value,
            asset_count: saleData?.scrapAssets?.length || 0
        }),
        responseData: JSON.stringify({
            status: 'Request received, validating scrap sale data'
        }),
        userId: userId
    });
}

// Get All Scrap Sales API
async function logGetAllScrapSalesApiCalled(options) {
    const { method, url, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_ALL_SCRAP_SALES_API_CALLED',
        module: 'ScrapSalesController',
        message: `INFO: GET ${url} - Get all scrap sales API called`,
        requestData: JSON.stringify({
            method,
            url,
            operation: 'getAllScrapSales'
        }),
        responseData: JSON.stringify({
            status: 'Request received, fetching scrap sales list'
        }),
        userId: userId
    });
}

// Get Scrap Sale by ID API
async function logGetScrapSaleByIdApiCalled(options) {
    const { method, url, sshId, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_SCRAP_SALE_BY_ID_API_CALLED',
        module: 'ScrapSalesController',
        message: `INFO: GET ${url} - Get scrap sale by ID API called`,
        requestData: JSON.stringify({
            method,
            url,
            operation: 'getScrapSaleById',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            status: 'Request received, fetching scrap sale details'
        }),
        userId: userId
    });
}

// Validate Scrap Assets API
async function logValidateScrapAssetsApiCalled(options) {
    const { method, url, userId, asdIds } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATE_SCRAP_ASSETS_API_CALLED',
        module: 'ScrapSalesController',
        message: `INFO: POST ${url} - Validate scrap assets API called`,
        requestData: JSON.stringify({
            method,
            url,
            operation: 'validateScrapAssetsForSale',
            asset_count: asdIds?.length || 0
        }),
        responseData: JSON.stringify({
            status: 'Request received, validating scrap assets'
        }),
        userId: userId
    });
}

// ============================================================================
// VALIDATION LOGGING

// Missing required fields
async function logMissingRequiredFields(options) {
    const { operation, missingFields, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_REQUIRED_FIELDS',
        module: 'ScrapSalesController',
        message: `WARNING: Missing required fields for ${operation}: ${missingFields.join(', ')}`,
        requestData: JSON.stringify({
            operation,
            missing_fields: missingFields
        }),
        responseData: JSON.stringify({
            validation_failed: true,
            missing_fields: missingFields
        }),
        duration: duration,
        userId: userId
    });
}

// Validation success
async function logValidationSuccess(options) {
    const { operation, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATION_SUCCESS',
        module: 'ScrapSalesController',
        message: `INFO: ${operation} validation completed successfully`,
        requestData: JSON.stringify({
            operation
        }),
        responseData: JSON.stringify({
            validation_passed: true
        }),
        duration: duration,
        userId: userId
    });
}

// ============================================================================
// PROCESSING LOGGING

// Processing scrap sale creation
async function logProcessingScrapSaleCreation(options) {
    const { sshId, buyerName, totalValue, assetCount, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'PROCESSING_SCRAP_SALE_CREATION',
        module: 'ScrapSalesController',
        message: `INFO: Processing scrap sale creation for buyer ${buyerName}`,
        requestData: JSON.stringify({
            operation: 'createScrapSale',
            buyer_name: buyerName,
            total_sale_value: totalValue,
            asset_count: assetCount
        }),
        responseData: JSON.stringify({
            status: 'Processing scrap sale creation in database'
        }),
        userId: userId
    });
}

// Processing asset validation
async function logProcessingAssetValidation(options) {
    const { asdIds, userId } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'PROCESSING_ASSET_VALIDATION',
        module: 'ScrapSalesController',
        message: `INFO: Processing validation for ${asdIds.length} scrap assets`,
        requestData: JSON.stringify({
            operation: 'validateScrapAssets',
            asset_count: asdIds.length
        }),
        responseData: JSON.stringify({
            status: 'Validating assets in database'
        }),
        userId: userId
    });
}

// ============================================================================
// SUCCESS LOGGING

// Scrap sale created successfully
async function logScrapSaleCreated(options) {
    const { sshId, buyerName, totalValue, assetCount, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_SALE_CREATED',
        module: 'ScrapSalesController',
        message: `INFO: Scrap sale ${sshId} created successfully for buyer ${buyerName}`,
        requestData: JSON.stringify({
            operation: 'createScrapSale',
            ssh_id: sshId,
            buyer_name: buyerName
        }),
        responseData: JSON.stringify({
            success: true,
            ssh_id: sshId,
            buyer_name: buyerName,
            total_sale_value: totalValue,
            asset_count: assetCount
        }),
        duration: duration,
        userId: userId
    });
}

// Scrap sales retrieved successfully
async function logScrapSalesRetrieved(options) {
    const { count, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_SALES_RETRIEVED',
        module: 'ScrapSalesController',
        message: `INFO: Retrieved ${count} scrap sales`,
        requestData: JSON.stringify({
            operation: 'getAllScrapSales'
        }),
        responseData: JSON.stringify({
            count,
            has_scrap_sales: count > 0
        }),
        duration: duration,
        userId: userId
    });
}

// Scrap sale detail retrieved successfully
async function logScrapSaleDetailRetrieved(options) {
    const { sshId, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_SALE_DETAIL_RETRIEVED',
        module: 'ScrapSalesController',
        message: `INFO: Scrap sale ${sshId} detail retrieved successfully`,
        requestData: JSON.stringify({
            operation: 'getScrapSaleById',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            success: true,
            ssh_id: sshId
        }),
        duration: duration,
        userId: userId
    });
}

// Asset validation completed successfully
async function logAssetValidationCompleted(options) {
    const { validCount, alreadySoldCount, invalidCount, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSET_VALIDATION_COMPLETED',
        module: 'ScrapSalesController',
        message: `INFO: Asset validation completed - Valid: ${validCount}, Already Sold: ${alreadySoldCount}, Invalid: ${invalidCount}`,
        requestData: JSON.stringify({
            operation: 'validateScrapAssets'
        }),
        responseData: JSON.stringify({
            valid_assets: validCount,
            already_sold: alreadySoldCount,
            invalid_assets: invalidCount
        }),
        duration: duration,
        userId: userId
    });
}

// ============================================================================
// WARNING LOGGING

// No scrap sales found
async function logNoScrapSalesFound(options) {
    const { userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'NO_SCRAP_SALES_FOUND',
        module: 'ScrapSalesController',
        message: `WARNING: No scrap sales found`,
        requestData: JSON.stringify({
            operation: 'getAllScrapSales'
        }),
        responseData: JSON.stringify({
            count: 0,
            has_scrap_sales: false
        }),
        duration: duration,
        userId: userId
    });
}

// Scrap sale not found
async function logScrapSaleNotFound(options) {
    const { sshId, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'SCRAP_SALE_NOT_FOUND',
        module: 'ScrapSalesController',
        message: `WARNING: Scrap sale ${sshId} not found`,
        requestData: JSON.stringify({
            operation: 'getScrapSaleById',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            found: false,
            ssh_id: sshId
        }),
        duration: duration,
        userId: userId
    });
}

// Assets already sold
async function logAssetsAlreadySold(options) {
    const { alreadySoldAssets, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'ASSETS_ALREADY_SOLD',
        module: 'ScrapSalesController',
        message: `WARNING: ${alreadySoldAssets.length} assets are already sold`,
        requestData: JSON.stringify({
            operation: 'createScrapSale',
            already_sold_count: alreadySoldAssets.length
        }),
        responseData: JSON.stringify({
            already_sold: alreadySoldAssets.map(asset => ({
                asd_id: asset.asd_id,
                asset_name: asset.asset_name,
                serial_number: asset.serial_number
            }))
        }),
        duration: duration,
        userId: userId
    });
}

// Value mismatch
async function logValueMismatch(options) {
    const { totalSaleValue, calculatedValue, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'VALUE_MISMATCH',
        module: 'ScrapSalesController',
        message: `WARNING: Total sale value (${totalSaleValue}) does not match calculated value (${calculatedValue})`,
        requestData: JSON.stringify({
            operation: 'createScrapSale',
            total_sale_value: totalSaleValue,
            calculated_value: calculatedValue
        }),
        responseData: JSON.stringify({
            value_mismatch: true,
            total_sale_value: totalSaleValue,
            calculated_value: calculatedValue
        }),
        duration: duration,
        userId: userId
    });
}

// ============================================================================
// ERROR LOGGING

// Scrap sale creation error
async function logScrapSaleCreationError(options) {
    const { error, userId, duration, saleData } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'SCRAP_SALE_CREATION_ERROR',
        module: 'ScrapSalesController',
        message: `ERROR: Scrap sale creation failed - ${error.message}`,
        requestData: JSON.stringify({
            operation: 'createScrapSale',
            buyer_name: saleData?.buyer_name,
            total_sale_value: saleData?.total_sale_value
        }),
        responseData: JSON.stringify({
            error: error.message,
            success: false
        }),
        duration: duration,
        userId: userId
    });
}

// Scrap sales retrieval error
async function logScrapSalesRetrievalError(options) {
    const { error, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'SCRAP_SALES_RETRIEVAL_ERROR',
        module: 'ScrapSalesController',
        message: `ERROR: Failed to retrieve scrap sales - ${error.message}`,
        requestData: JSON.stringify({
            operation: 'getAllScrapSales'
        }),
        responseData: JSON.stringify({
            error: error.message,
            success: false
        }),
        duration: duration,
        userId: userId
    });
}

// Scrap sale detail retrieval error
async function logScrapSaleDetailRetrievalError(options) {
    const { sshId, error, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'SCRAP_SALE_DETAIL_RETRIEVAL_ERROR',
        module: 'ScrapSalesController',
        message: `ERROR: Failed to retrieve scrap sale ${sshId} - ${error.message}`,
        requestData: JSON.stringify({
            operation: 'getScrapSaleById',
            ssh_id: sshId
        }),
        responseData: JSON.stringify({
            error: error.message,
            success: false
        }),
        duration: duration,
        userId: userId
    });
}

// Asset validation error
async function logAssetValidationError(options) {
    const { error, userId, duration, asdIds } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ASSET_VALIDATION_ERROR',
        module: 'ScrapSalesController',
        message: `ERROR: Asset validation failed - ${error.message}`,
        requestData: JSON.stringify({
            operation: 'validateScrapAssets',
            asset_count: asdIds?.length || 0
        }),
        responseData: JSON.stringify({
            error: error.message,
            success: false
        }),
        duration: duration,
        userId: userId
    });
}

// ============================================================================
// CRITICAL LOGGING

// Database connection failure
async function logDatabaseConnectionFailure(options) {
    const { operation, error, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'CRITICAL',
        eventType: 'DATABASE_CONNECTION_FAILURE',
        module: 'ScrapSalesController',
        message: `CRITICAL: Database connection failed during ${operation}`,
        requestData: JSON.stringify({
            operation
        }),
        responseData: JSON.stringify({
            error: error.message,
            connection_failed: true
        }),
        duration: duration,
        userId: userId
    });
}

// Database constraint violation
async function logDatabaseConstraintViolation(options) {
    const { operation, error, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'CRITICAL',
        eventType: 'DATABASE_CONSTRAINT_VIOLATION',
        module: 'ScrapSalesController',
        message: `CRITICAL: Database constraint violation during ${operation}`,
        requestData: JSON.stringify({
            operation
        }),
        responseData: JSON.stringify({
            error: error.message,
            constraint_violation: true
        }),
        duration: duration,
        userId: userId
    });
}

// System integrity violation
async function logSystemIntegrityViolation(options) {
    const { operation, error, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'CRITICAL',
        eventType: 'SYSTEM_INTEGRITY_VIOLATION',
        module: 'ScrapSalesController',
        message: `CRITICAL: System integrity violation during ${operation}`,
        requestData: JSON.stringify({
            operation
        }),
        responseData: JSON.stringify({
            error: error.message,
            integrity_violation: true
        }),
        duration: duration,
        userId: userId
    });
}

// Unauthorized access attempt
async function logUnauthorizedAccessAttempt(options) {
    const { operation, userId, duration } = options;
    return eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'CRITICAL',
        eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        module: 'ScrapSalesController',
        message: `CRITICAL: Unauthorized access attempt for ${operation}`,
        requestData: JSON.stringify({
            operation,
            userId: userId
        }),
        responseData: JSON.stringify({
            unauthorized_access: true
        }),
        duration: duration,
        userId: userId
    });
}

// ============================================================================
// EXPORTS

module.exports = {
    // Generic helpers
    logApiCall,
    logOperationSuccess,
    logOperationError,
    
    // Data flow and storage logging
    logDataPreparationStarted,
    logDataPreparationCompleted,
    logDatabaseTransactionStarted,
    logDatabaseTransactionCompleted,
    logHeaderTableInserted,
    logDetailsTableInserted,
    logAssetStatusUpdated,
    
    // Delete operation logging
    logDeleteScrapSaleApiCalled,
    logScrapSaleDeletionStarted,
    logDocumentsDeleted,
    logDetailsDeleted,
    logHeaderDeleted,
    logScrapSaleDeleted,
    logScrapSaleDeletionError,
    logScrapSaleNotFoundForDeletion,
    
    // API call logging
    logCreateScrapSaleApiCalled,
    logGetAllScrapSalesApiCalled,
    logGetScrapSaleByIdApiCalled,
    logValidateScrapAssetsApiCalled,
    
    // Validation logging
    logMissingRequiredFields,
    logValidationSuccess,
    
    // Processing logging
    logProcessingScrapSaleCreation,
    logProcessingAssetValidation,
    
    // Success logging
    logScrapSaleCreated,
    logScrapSalesRetrieved,
    logScrapSaleDetailRetrieved,
    logAssetValidationCompleted,
    
    // Warning logging
    logNoScrapSalesFound,
    logScrapSaleNotFound,
    logAssetsAlreadySold,
    logValueMismatch,
    
    // Error logging
    logScrapSaleCreationError,
    logScrapSalesRetrievalError,
    logScrapSaleDetailRetrievalError,
    logAssetValidationError,
    
    // Critical logging
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation,
    logSystemIntegrityViolation,
    logUnauthorizedAccessAttempt
};
