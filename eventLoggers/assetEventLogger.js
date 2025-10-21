const eventLogger = require('../services/eventLogger');

/**
 * Asset Event Logger
 * Centralized logging for asset-related events
 * All log level decisions for asset events are made here
 */

// ==================== DETAILED FLOW LOGGING ====================

/**
 * Log asset creation API called (INFO)
 */
async function logAssetCreationApiCalled(options) {
    const { assetName, method, url, userId, requestBody } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'API_CALL',
        module: 'AssetController',
        message: `INFO: ${method} ${url} - Asset creation API called`,
        logLevel: 'INFO',
        requestData: { 
            method, 
            url,
            asset_name: assetName,
            asset_type_id: requestBody?.asset_type_id,
            branch_id: requestBody?.branch_id,
            purchase_vendor_id: requestBody?.purchase_vendor_id,
            service_vendor_id: requestBody?.service_vendor_id,
            purchased_cost: requestBody?.purchased_cost,
            purchased_on: requestBody?.purchased_on,
            current_status: requestBody?.current_status
        },
        responseData: { status: 'Request received, starting processing' },
        duration: null,
        userId
    });
}

/**
 * Log checking asset type in database (INFO)
 */
async function logCheckingAssetType(options) {
    const { assetTypeId, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'DB_QUERY',
        module: 'AssetController',
        message: `INFO: Validating asset type in database`,
        logLevel: 'INFO',
        requestData: { asset_type_id: assetTypeId },
        responseData: { status: 'checking' },
        duration: null,
        userId
    });
}

/**
 * Log checking vendor validity (INFO)
 */
async function logCheckingVendor(options) {
    const { vendorId, vendorType, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'DB_QUERY',
        module: 'AssetController',
        message: `INFO: Validating ${vendorType} vendor in database`,
        logLevel: 'INFO',
        requestData: { 
            vendor_id: vendorId, 
            vendor_type: vendorType,
            query: 'checkVendorExists'
        },
        responseData: { status: 'querying database' },
        duration: null,
        userId
    });
}

/**
 * Log vendor validated successfully (INFO)
 */
async function logVendorValidated(options) {
    const { vendorId, vendorType, userId, vendorData } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'DB_QUERY',
        module: 'AssetController',
        message: `INFO: ${vendorType} vendor validated successfully`,
        logLevel: 'INFO',
        requestData: { vendor_id: vendorId, vendor_type: vendorType },
        responseData: { 
            vendorValid: true,
            vendorExists: true,
            vendorName: vendorData?.text || 'N/A'
        },
        duration: null,
        userId
    });
}

/**
 * Log generating asset ID (INFO)
 */
async function logGeneratingAssetId(options) {
    const { userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_CREATE',
        module: 'AssetController',
        message: `INFO: Generating new asset ID`,
        logLevel: 'INFO',
        requestData: { operation: 'generateAssetId' },
        responseData: { status: 'generating' },
        duration: null,
        userId
    });
}

/**
 * Log asset ID generated (INFO)
 */
async function logAssetIdGenerated(options) {
    const { assetId, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_CREATE',
        module: 'AssetController',
        message: `INFO: Asset ID generated - ${assetId}`,
        logLevel: 'INFO',
        requestData: { asset_id: assetId },
        responseData: { assetIdGenerated: true },
        duration: null,
        userId
    });
}

/**
 * Log inserting asset to database (INFO)
 */
async function logInsertingAssetToDatabase(options) {
    const { assetId, assetName, assetData, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'DB_QUERY',
        module: 'AssetController',
        message: `INFO: Inserting asset to database`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId, 
            asset_name: assetName,
            asset_type_id: assetData?.asset_type_id,
            branch_id: assetData?.branch_id,
            purchase_vendor_id: assetData?.purchase_vendor_id,
            service_vendor_id: assetData?.service_vendor_id,
            purchased_cost: assetData?.purchased_cost,
            current_status: assetData?.current_status,
            query: 'INSERT INTO tblAssets'
        },
        responseData: { status: 'executing INSERT query' },
        duration: null,
        userId
    });
}

/**
 * Log asset inserted successfully (INFO)
 */
async function logAssetInsertedToDatabase(options) {
    const { assetId, assetName, insertedData, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'DB_QUERY',
        module: 'AssetController',
        message: `INFO: Asset inserted to database successfully`,
        logLevel: 'INFO',
        requestData: { asset_id: assetId, asset_name: assetName },
        responseData: { 
            inserted: true,
            asset_id: insertedData?.asset_id,
            serial_number: insertedData?.serial_number,
            current_status: insertedData?.current_status,
            created_on: insertedData?.created_on
        },
        duration: null,
        userId
    });
}

/**
 * Log inserting asset properties (INFO)
 */
async function logInsertingAssetProperties(options) {
    const { assetId, propertyCount, properties, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'DB_QUERY',
        module: 'AssetController',
        message: `INFO: Inserting ${propertyCount} asset properties`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId, 
            property_count: propertyCount,
            properties: properties,
            query: 'INSERT INTO tblAssetPropValues'
        },
        responseData: { status: 'Inserting property values to database' },
        duration: null,
        userId
    });
}

/**
 * Log document upload API called (INFO)
 */
async function logDocumentUploadApiCalled(options) {
    const { assetId, fileName, fileSize, mimeType, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'API_CALL',
        module: 'AssetDocsController',
        message: `INFO: Document upload API called for asset ${assetId}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            file_name: fileName,
            file_size: fileSize,
            mime_type: mimeType,
            operation: 'uploadDocument'
        },
        responseData: { status: 'Processing file upload' },
        duration: null,
        userId
    });
}

/**
 * Log uploading file to MinIO (INFO)
 */
async function logUploadingToMinIO(options) {
    const { assetId, fileName, objectName, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'FILE_UPLOAD',
        module: 'AssetDocsController',
        message: `INFO: Uploading file to MinIO storage`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            file_name: fileName,
            object_name: objectName,
            storage: 'MinIO'
        },
        responseData: { status: 'Uploading to object storage' },
        duration: null,
        userId
    });
}

/**
 * Log file uploaded to MinIO successfully (INFO)
 */
async function logFileUploadedToMinIO(options) {
    const { assetId, fileName, objectName, fileSize, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'FILE_UPLOAD',
        module: 'AssetDocsController',
        message: `INFO: File uploaded to MinIO successfully`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            file_name: fileName,
            file_size: fileSize
        },
        responseData: { 
            uploaded: true,
            object_name: objectName,
            storage_bucket: 'assetlifecycle'
        },
        duration: null,
        userId
    });
}

/**
 * Log inserting document metadata to database (INFO)
 */
async function logInsertingDocumentMetadata(options) {
    const { documentId, assetId, docTypeName, docPath, userId } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'DB_QUERY',
        module: 'AssetDocsController',
        message: `INFO: Inserting document metadata to database`,
        logLevel: 'INFO',
        requestData: { 
            document_id: documentId,
            asset_id: assetId,
            doc_type_name: docTypeName,
            doc_path: docPath,
            query: 'INSERT INTO tblAssetDocs'
        },
        responseData: { status: 'Inserting document metadata' },
        duration: null,
        userId
    });
}

/**
 * Log document uploaded successfully (INFO)
 */
async function logDocumentUploaded(options) {
    const { documentId, assetId, fileName, docTypeName, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'DOCUMENT_UPLOAD',
        module: 'AssetDocsController',
        message: `INFO: Document uploaded successfully - ${fileName}`,
        logLevel: 'INFO',
        requestData: { 
            asset_id: assetId,
            file_name: fileName,
            doc_type_name: docTypeName
        },
        responseData: { 
            success: true,
            document_id: documentId,
            uploadComplete: true
        },
        duration,
        userId
    });
}

/**
 * Log document upload error (ERROR)
 */
async function logDocumentUploadError(options) {
    const { assetId, fileName, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'DOCUMENT_UPLOAD',
        module: 'AssetDocsController',
        message: `ERROR: Document upload failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { 
            asset_id: assetId,
            file_name: fileName
        },
        responseData: { 
            error: error.message,
            uploadFailed: true
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
        appId: 'ASSETS',
        eventType: 'API_CALL',
        module: 'AssetController',
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
        appId: 'ASSETS',
        eventType: 'ASSET_OPERATION',
        module: 'AssetController',
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
        appId: 'ASSETS',
        eventType: 'ASSET_OPERATION',
        module: 'AssetController',
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
 * Log successful asset creation (INFO)
 */
async function logAssetCreated(options) {
    const { assetId, assetName, assetTypeId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_CREATE',
        module: 'AssetController',
        message: `INFO: Asset created successfully - ${assetName}`,
        logLevel: 'INFO',
        requestData: { asset_id: assetId, asset_name: assetName, asset_type_id: assetTypeId },
        responseData: { success: true, asset_id: assetId },
        duration,
        userId
    });
}

/**
 * Log successful asset retrieval (INFO)
 */
async function logAssetsRetrieved(options) {
    const { operation = 'getAllAssets', count, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_VIEW',
        module: 'AssetController',
        message: `INFO: Retrieved all assets successfully`,
        logLevel: 'INFO',
        requestData: { operation },
        responseData: { count },
        duration,
        userId
    });
}

/**
 * Log successful asset update (INFO)
 */
async function logAssetUpdated(options) {
    const { assetId, assetName, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_UPDATE',
        module: 'AssetController',
        message: `INFO: Asset updated successfully - ${assetName}`,
        logLevel: 'INFO',
        requestData: { asset_id: assetId, asset_name: assetName },
        responseData: { success: true },
        duration,
        userId
    });
}

/**
 * Log successful asset deletion (INFO)
 */
async function logAssetDeleted(options) {
    const { assetId, assetName, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_DELETE',
        module: 'AssetController',
        message: `INFO: Asset deleted successfully - ${assetName || assetId}`,
        logLevel: 'INFO',
        requestData: { asset_id: assetId },
        responseData: { success: true },
        duration,
        userId
    });
}

// ==================== WARNING LEVEL EVENTS ====================

/**
 * Log unauthorized access attempt (WARNING)
 */
async function logUnauthorizedAccess(options) {
    const { operation, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_CREATE',
        module: 'AssetController',
        message: `WARNING: Unauthorized asset ${operation} attempt`,
        logLevel: 'WARNING',
        requestData: { operation },
        responseData: { error: 'User not authenticated' },
        duration,
        userId: null
    });
}

/**
 * Log missing required fields (WARNING)
 */
async function logMissingRequiredFields(options) {
    const { text, orgId, assetTypeId, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_CREATE',
        module: 'AssetController',
        message: 'WARNING: Asset creation failed - missing required fields',
        logLevel: 'WARNING',
        requestData: { text, org_id: orgId, asset_type_id: assetTypeId },
        responseData: { error: 'Required fields missing' },
        duration,
        userId
    });
}

/**
 * Log invalid vendor (WARNING)
 */
async function logInvalidVendor(options) {
    const { vendorId, vendorType = 'purchase', assetName, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_CREATE',
        module: 'AssetController',
        message: `WARNING: Asset creation failed - invalid ${vendorType} vendor`,
        logLevel: 'WARNING',
        requestData: { 
            [`${vendorType}_vendor_id`]: vendorId, 
            asset_name: assetName 
        },
        responseData: { error: 'Vendor does not exist' },
        duration,
        userId
    });
}

/**
 * Log duplicate asset ID (WARNING)
 */
async function logDuplicateAssetId(options) {
    const { assetId, assetName, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_CREATE',
        module: 'AssetController',
        message: 'WARNING: Asset creation failed - duplicate asset ID',
        logLevel: 'WARNING',
        requestData: { asset_id: assetId, asset_name: assetName },
        responseData: { error: 'Asset ID already exists' },
        duration,
        userId
    });
}

/**
 * Log asset not found (WARNING)
 */
async function logAssetNotFound(options) {
    const { assetId, operation, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_VIEW',
        module: 'AssetController',
        message: `WARNING: Asset not found - ${assetId}`,
        logLevel: 'WARNING',
        requestData: { asset_id: assetId, operation },
        responseData: { error: 'Asset not found' },
        duration,
        userId
    });
}

// ==================== ERROR LEVEL EVENTS ====================

/**
 * Log general asset creation error (ERROR)
 */
async function logAssetCreationError(options) {
    const { assetName, assetTypeId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_CREATE',
        module: 'AssetController',
        message: `ERROR: Asset creation failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { asset_name: assetName, asset_type_id: assetTypeId },
        responseData: { error: error.message, code: error.code },
        duration,
        userId
    });
}

/**
 * Log asset retrieval error (ERROR)
 */
async function logAssetRetrievalError(options) {
    const { operation = 'getAllAssets', error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_VIEW',
        module: 'AssetController',
        message: `ERROR: Failed to retrieve assets - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { operation },
        responseData: { error: error.message },
        duration,
        userId
    });
}

/**
 * Log asset update error (ERROR)
 */
async function logAssetUpdateError(options) {
    const { assetId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_UPDATE',
        module: 'AssetController',
        message: `ERROR: Asset update failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { asset_id: assetId },
        responseData: { error: error.message },
        duration,
        userId
    });
}

/**
 * Log asset deletion error (ERROR)
 */
async function logAssetDeletionError(options) {
    const { assetId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_DELETE',
        module: 'AssetController',
        message: `ERROR: Asset deletion failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData: { asset_id: assetId },
        responseData: { error: error.message },
        duration,
        userId
    });
}

// ==================== CRITICAL LEVEL EVENTS ====================

/**
 * Log database constraint violation (CRITICAL)
 */
async function logDatabaseConstraintViolation(options) {
    const { assetName, assetTypeId, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'ASSET_CREATE',
        module: 'AssetController',
        message: `CRITICAL: Asset creation failed - database constraint violation`,
        logLevel: 'CRITICAL',
        requestData: { asset_name: assetName, asset_type_id: assetTypeId },
        responseData: { 
            error: error.message, 
            code: error.code,
            constraint: error.constraint 
        },
        duration,
        userId
    });
}

/**
 * Log database connection failure (CRITICAL)
 */
async function logDatabaseConnectionFailure(options) {
    const { operation, error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'ASSETS',
        eventType: 'SYSTEM_FAILURE',
        module: 'AssetController',
        message: `CRITICAL: Database connection failed during ${operation}`,
        logLevel: 'CRITICAL',
        requestData: { operation },
        responseData: { 
            error: error.message,
            code: error.code
        },
        duration,
        userId
    });
}

module.exports = {
    // Generic helpers (use for any operation)
    logApiCall,
    logOperationSuccess,
    logOperationError,
    // Detailed flow logging - Asset Creation
    logAssetCreationApiCalled,
    logCheckingAssetType,
    logCheckingVendor,
    logVendorValidated,
    logGeneratingAssetId,
    logAssetIdGenerated,
    logInsertingAssetToDatabase,
    logAssetInsertedToDatabase,
    logInsertingAssetProperties,
    // Detailed flow logging - Document Upload
    logDocumentUploadApiCalled,
    logUploadingToMinIO,
    logFileUploadedToMinIO,
    logInsertingDocumentMetadata,
    logDocumentUploaded,
    logDocumentUploadError,
    // INFO
    logAssetCreated,
    logAssetsRetrieved,
    logAssetUpdated,
    logAssetDeleted,
    // WARNING
    logUnauthorizedAccess,
    logMissingRequiredFields,
    logInvalidVendor,
    logDuplicateAssetId,
    logAssetNotFound,
    // ERROR
    logAssetCreationError,
    logAssetRetrievalError,
    logAssetUpdateError,
    logAssetDeletionError,
    // CRITICAL
    logDatabaseConstraintViolation,
    logDatabaseConnectionFailure
};