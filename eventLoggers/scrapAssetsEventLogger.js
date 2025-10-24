const eventLogger = require('../services/eventLogger');
const APP_ID = 'SCRAPASSETS';

/**
 * Scrap Assets Event Logger
 * Comprehensive logging for all scrap assets operations
 */

// ===== GENERAL LOGGING FUNCTIONS =====

async function logApiCall(options) {
    const { appId = APP_ID, eventType, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId,
        logLevel: 'INFO',
        eventType,
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
        requestData,
        responseData: { error: error.message || error },
        userId,
        duration
    });
}

// ===== SCRAP ASSETS LIST OPERATIONS =====

async function logGetAllScrapAssetsApiCalled(options) {
    const { requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSETS_LIST_API_CALLED',
        module: 'AssetScrapController',
        message: 'INFO: Get all scrap assets API called',
        requestData,
        userId,
        duration
    });
}

async function logQueryingScrapAssets(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_SCRAP_ASSETS',
        module: 'AssetScrapController',
        message: 'INFO: Querying scrap assets from database',
        requestData: { operation: 'fetch_all_scrap_assets' },
        userId
    });
}

async function logNoScrapAssetsFound(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'NO_SCRAP_ASSETS_FOUND',
        module: 'AssetScrapController',
        message: 'WARNING: No scrap assets found in database',
        requestData: { message: 'No scrap assets found in database' },
        userId
    });
}

async function logScrapAssetsRetrieved(options) {
    const { count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSETS_RETRIEVED',
        module: 'AssetScrapController',
        message: `INFO: Retrieved ${count} scrap assets`,
        requestData: { count, message: `Retrieved ${count} scrap assets` },
        userId
    });
}

async function logScrapAssetsRetrievalError(options) {
    const { error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'SCRAP_ASSETS_RETRIEVAL_ERROR',
        module: 'AssetScrapController',
        message: 'ERROR: Failed to retrieve scrap assets',
        requestData: { error: error.message || error },
        userId
    });
}

// ===== SCRAP ASSET BY ID OPERATIONS =====

async function logGetScrapAssetByIdApiCalled(options) {
    const { scrapAssetId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSET_BY_ID_API_CALLED',
        module: 'AssetScrapController',
        message: 'INFO: Get scrap asset by ID API called',
        requestData: { scrapAssetId, ...requestData },
        userId,
        duration
    });
}

async function logQueryingScrapAssetById(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_SCRAP_ASSET_BY_ID',
        module: 'AssetScrapController',
        message: 'INFO: Querying scrap asset by ID from database',
        requestData: { scrapAssetId, operation: 'fetch_scrap_asset_by_id' },
        userId
    });
}

async function logScrapAssetNotFound(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'SCRAP_ASSET_NOT_FOUND',
        module: 'AssetScrapController',
        message: 'WARNING: Scrap asset not found',
        requestData: { scrapAssetId, message: 'Scrap asset not found' },
        userId
    });
}

async function logScrapAssetDetailRetrieved(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSET_DETAIL_RETRIEVED',
        module: 'AssetScrapController',
        message: 'INFO: Scrap asset detail retrieved successfully',
        requestData: { scrapAssetId, message: 'Scrap asset detail retrieved successfully' },
        userId
    });
}

async function logScrapAssetDetailRetrievalError(options) {
    const { scrapAssetId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'SCRAP_ASSET_DETAIL_RETRIEVAL_ERROR',
        module: 'AssetScrapController',
        message: 'ERROR: Failed to retrieve scrap asset detail',
        requestData: { scrapAssetId, error: error.message || error },
        userId
    });
}

// ===== AVAILABLE ASSETS BY TYPE OPERATIONS =====

async function logGetAvailableAssetsByTypeApiCalled(options) {
    const { assetTypeId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'AVAILABLE_ASSETS_BY_TYPE_API_CALLED',
        module: 'AssetScrapController',
        message: 'INFO: Get available assets by type API called',
        requestData: { assetTypeId, ...requestData },
        userId,
        duration
    });
}

async function logQueryingAvailableAssetsByType(options) {
    const { assetTypeId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_AVAILABLE_ASSETS_BY_TYPE',
        module: 'AssetScrapController',
        message: 'INFO: Querying available assets by type from database',
        requestData: { assetTypeId, operation: 'fetch_available_assets_by_type' },
        userId
    });
}

async function logNoAvailableAssetsFound(options) {
    const { assetTypeId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'NO_AVAILABLE_ASSETS_FOUND',
        module: 'AssetScrapController',
        message: 'WARNING: No available assets found for this asset type',
        requestData: { assetTypeId, message: 'No available assets found for this asset type' },
        userId
    });
}

async function logAvailableAssetsRetrieved(options) {
    const { assetTypeId, count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'AVAILABLE_ASSETS_RETRIEVED',
        module: 'AssetScrapController',
        message: `INFO: Retrieved ${count} available assets for type ${assetTypeId}`,
        requestData: { assetTypeId, count, message: `Retrieved ${count} available assets for type ${assetTypeId}` },
        userId
    });
}

async function logAvailableAssetsRetrievalError(options) {
    const { assetTypeId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'AVAILABLE_ASSETS_RETRIEVAL_ERROR',
        module: 'AssetScrapController',
        message: 'ERROR: Failed to retrieve available assets by type',
        requestData: { assetTypeId, error: error.message || error },
        userId
    });
}

// ===== ADD SCRAP ASSET OPERATIONS =====

async function logAddScrapAssetApiCalled(options) {
    const { requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ADD_SCRAP_ASSET_API_CALLED',
        module: 'AssetScrapController',
        message: 'INFO: Add scrap asset API called',
        requestData,
        userId,
        duration
    });
}

async function logValidatingScrapAssetData(options) {
    const { requestData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_SCRAP_ASSET_DATA',
        module: 'AssetScrapController',
        message: 'INFO: Validating scrap asset data',
        requestData: { ...requestData, operation: 'validating_required_fields' },
        userId
    });
}

async function logMissingRequiredFields(options) {
    const { missingFields, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_REQUIRED_FIELDS',
        module: 'AssetScrapController',
        message: 'WARNING: Required fields are missing',
        requestData: { missingFields, message: 'Required fields are missing' },
        userId
    });
}

async function logValidationSuccess(options) {
    const { requestData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATION_SUCCESS',
        module: 'AssetScrapController',
        message: 'INFO: Scrap asset data validation successful',
        requestData: { ...requestData, message: 'Scrap asset data validation successful' },
        userId
    });
}

async function logProcessingScrapAssetCreation(options) {
    const { requestData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'PROCESSING_SCRAP_ASSET_CREATION',
        module: 'AssetScrapController',
        message: 'INFO: Processing scrap asset creation',
        requestData: { ...requestData, operation: 'creating_scrap_asset' },
        userId
    });
}

async function logInsertingScrapAssetToDatabase(options) {
    const { requestData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'INSERTING_SCRAP_ASSET_TO_DATABASE',
        module: 'AssetScrapController',
        message: 'INFO: Inserting scrap asset to database',
        requestData: { ...requestData, operation: 'database_insert' },
        userId
    });
}

async function logScrapAssetInsertedToDatabase(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSET_INSERTED_TO_DATABASE',
        module: 'AssetScrapController',
        message: 'INFO: Scrap asset inserted successfully',
        requestData: { scrapAssetId, message: 'Scrap asset inserted successfully' },
        userId
    });
}

async function logScrapAssetCreated(options) {
    const { scrapAssetId, requestData, responseData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSET_CREATED',
        module: 'AssetScrapController',
        message: 'INFO: Scrap asset created successfully',
        requestData: { scrapAssetId, ...requestData },
        responseData,
        userId,
        duration
    });
}

async function logScrapAssetCreationError(options) {
    const { error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'SCRAP_ASSET_CREATION_ERROR',
        module: 'AssetScrapController',
        message: 'ERROR: Failed to create scrap asset',
        requestData: { error: error.message || error },
        userId
    });
}

// ===== UPDATE SCRAP ASSET OPERATIONS =====

async function logUpdateScrapAssetApiCalled(options) {
    const { scrapAssetId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPDATE_SCRAP_ASSET_API_CALLED',
        module: 'AssetScrapController',
        message: 'INFO: Update scrap asset API called',
        requestData: { scrapAssetId, ...requestData },
        userId,
        duration
    });
}

async function logValidatingUpdateData(options) {
    const { scrapAssetId, requestData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_UPDATE_DATA',
        module: 'AssetScrapController',
        message: 'INFO: Validating update data',
        requestData: { scrapAssetId, ...requestData, operation: 'validating_update_fields' },
        userId
    });
}

async function logProcessingScrapAssetUpdate(options) {
    const { scrapAssetId, requestData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'PROCESSING_SCRAP_ASSET_UPDATE',
        module: 'AssetScrapController',
        message: 'INFO: Processing scrap asset update',
        requestData: { scrapAssetId, ...requestData, operation: 'updating_scrap_asset' },
        userId
    });
}

async function logUpdatingScrapAssetInDatabase(options) {
    const { scrapAssetId, requestData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPDATING_SCRAP_ASSET_IN_DATABASE',
        module: 'AssetScrapController',
        message: 'INFO: Updating scrap asset in database',
        requestData: { scrapAssetId, ...requestData, operation: 'database_update' },
        userId
    });
}

async function logScrapAssetUpdatedInDatabase(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSET_UPDATED_IN_DATABASE',
        module: 'AssetScrapController',
        message: 'INFO: Scrap asset updated successfully',
        requestData: { scrapAssetId, message: 'Scrap asset updated successfully' },
        userId
    });
}

async function logScrapAssetUpdated(options) {
    const { scrapAssetId, requestData, responseData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSET_UPDATED',
        module: 'AssetScrapController',
        message: 'INFO: Scrap asset updated successfully',
        requestData: { scrapAssetId, ...requestData },
        responseData,
        userId,
        duration
    });
}

async function logScrapAssetUpdateError(options) {
    const { scrapAssetId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'SCRAP_ASSET_UPDATE_ERROR',
        module: 'AssetScrapController',
        message: 'ERROR: Failed to update scrap asset',
        requestData: { scrapAssetId, error: error.message || error },
        userId
    });
}

// ===== DELETE SCRAP ASSET OPERATIONS =====

async function logDeleteScrapAssetApiCalled(options) {
    const { scrapAssetId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DELETE_SCRAP_ASSET_API_CALLED',
        module: 'AssetScrapController',
        message: 'INFO: Delete scrap asset API called',
        requestData: { scrapAssetId, ...requestData },
        userId,
        duration
    });
}

async function logValidatingScrapAssetDeletion(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_SCRAP_ASSET_DELETION',
        module: 'AssetScrapController',
        message: 'INFO: Validating scrap asset deletion',
        requestData: { scrapAssetId, operation: 'validating_deletion' },
        userId
    });
}

async function logProcessingScrapAssetDeletion(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'PROCESSING_SCRAP_ASSET_DELETION',
        module: 'AssetScrapController',
        message: 'INFO: Processing scrap asset deletion',
        requestData: { scrapAssetId, operation: 'deleting_scrap_asset' },
        userId
    });
}

async function logDeletingScrapAssetFromDatabase(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DELETING_SCRAP_ASSET_FROM_DATABASE',
        module: 'AssetScrapController',
        message: 'INFO: Deleting scrap asset from database',
        requestData: { scrapAssetId, operation: 'database_delete' },
        userId
    });
}

async function logScrapAssetDeletedFromDatabase(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSET_DELETED_FROM_DATABASE',
        module: 'AssetScrapController',
        message: 'INFO: Scrap asset deleted successfully',
        requestData: { scrapAssetId, message: 'Scrap asset deleted successfully' },
        userId
    });
}

async function logScrapAssetDeleted(options) {
    const { scrapAssetId, requestData, responseData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'SCRAP_ASSET_DELETED',
        module: 'AssetScrapController',
        message: 'INFO: Scrap asset deleted successfully',
        requestData: { scrapAssetId, ...requestData },
        responseData,
        userId,
        duration
    });
}

async function logScrapAssetDeletionError(options) {
    const { scrapAssetId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'SCRAP_ASSET_DELETION_ERROR',
        module: 'AssetScrapController',
        message: 'ERROR: Failed to delete scrap asset',
        requestData: { scrapAssetId, error: error.message || error },
        userId
    });
}

async function logScrapAssetNotFoundForDeletion(options) {
    const { scrapAssetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'SCRAP_ASSET_NOT_FOUND_FOR_DELETION',
        module: 'AssetScrapController',
        message: 'WARNING: Scrap asset not found for deletion',
        requestData: { scrapAssetId, message: 'Scrap asset not found for deletion' },
        userId
    });
}

// ===== NEARING EXPIRY OPERATIONS =====

async function logGetNearingExpiryApiCalled(options) {
    const { requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_NEARING_EXPIRY_API_CALLED',
        module: 'AssetController',
        message: 'INFO: Get nearing expiry assets API called',
        requestData,
        userId,
        duration
    });
}

async function logQueryingNearingExpiryAssets(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_NEARING_EXPIRY_ASSETS',
        module: 'AssetController',
        message: 'INFO: Querying nearing expiry assets from database',
        requestData: { operation: 'fetch_nearing_expiry_assets' },
        userId
    });
}

async function logNearingExpiryAssetsRetrieved(options) {
    const { count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'NEARING_EXPIRY_ASSETS_RETRIEVED',
        module: 'AssetController',
        message: `INFO: Retrieved ${count} nearing expiry assets`,
        requestData: { count, message: `Retrieved ${count} nearing expiry assets` },
        userId
    });
}

// ===== EXPIRED ASSETS OPERATIONS =====

async function logGetExpiredAssetsApiCalled(options) {
    const { requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_EXPIRED_ASSETS_API_CALLED',
        module: 'AssetController',
        message: 'INFO: Get expired assets API called',
        requestData,
        userId,
        duration
    });
}

async function logQueryingExpiredAssets(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_EXPIRED_ASSETS',
        module: 'AssetController',
        message: 'INFO: Querying expired assets from database',
        requestData: { operation: 'fetch_expired_assets' },
        userId
    });
}

async function logExpiredAssetsRetrieved(options) {
    const { count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'EXPIRED_ASSETS_RETRIEVED',
        module: 'AssetController',
        message: `INFO: Retrieved ${count} expired assets`,
        requestData: { count, message: `Retrieved ${count} expired assets` },
        userId
    });
}

// ===== CATEGORY ASSETS OPERATIONS =====

async function logGetCategoryAssetsApiCalled(options) {
    const { category, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_CATEGORY_ASSETS_API_CALLED',
        module: 'ScrapAssetsByTypeController',
        message: 'INFO: Get category assets API called',
        requestData: { category, ...requestData },
        userId,
        duration
    });
}

async function logQueryingCategoryAssets(options) {
    const { category, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_CATEGORY_ASSETS',
        module: 'ScrapAssetsByTypeController',
        message: 'INFO: Querying category assets from database',
        requestData: { category, operation: 'fetch_category_assets' },
        userId
    });
}

async function logCategoryAssetsRetrieved(options) {
    const { category, count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CATEGORY_ASSETS_RETRIEVED',
        module: 'ScrapAssetsByTypeController',
        message: `INFO: Retrieved ${count} assets for category ${category}`,
        requestData: { category, count, message: `Retrieved ${count} assets for category ${category}` },
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
        module: 'Database',
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
        module: 'Database',
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
        module: 'Database',
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
    
    // Scrap assets list operations
    logGetAllScrapAssetsApiCalled,
    logQueryingScrapAssets,
    logNoScrapAssetsFound,
    logScrapAssetsRetrieved,
    logScrapAssetsRetrievalError,
    
    // Scrap asset by ID operations
    logGetScrapAssetByIdApiCalled,
    logQueryingScrapAssetById,
    logScrapAssetNotFound,
    logScrapAssetDetailRetrieved,
    logScrapAssetDetailRetrievalError,
    
    // Available assets by type operations
    logGetAvailableAssetsByTypeApiCalled,
    logQueryingAvailableAssetsByType,
    logNoAvailableAssetsFound,
    logAvailableAssetsRetrieved,
    logAvailableAssetsRetrievalError,
    
    // Add scrap asset operations
    logAddScrapAssetApiCalled,
    logValidatingScrapAssetData,
    logMissingRequiredFields,
    logValidationSuccess,
    logProcessingScrapAssetCreation,
    logInsertingScrapAssetToDatabase,
    logScrapAssetInsertedToDatabase,
    logScrapAssetCreated,
    logScrapAssetCreationError,
    
    // Update scrap asset operations
    logUpdateScrapAssetApiCalled,
    logValidatingUpdateData,
    logProcessingScrapAssetUpdate,
    logUpdatingScrapAssetInDatabase,
    logScrapAssetUpdatedInDatabase,
    logScrapAssetUpdated,
    logScrapAssetUpdateError,
    
    // Delete scrap asset operations
    logDeleteScrapAssetApiCalled,
    logValidatingScrapAssetDeletion,
    logProcessingScrapAssetDeletion,
    logDeletingScrapAssetFromDatabase,
    logScrapAssetDeletedFromDatabase,
    logScrapAssetDeleted,
    logScrapAssetDeletionError,
    logScrapAssetNotFoundForDeletion,
    
    // Nearing expiry operations
    logGetNearingExpiryApiCalled,
    logQueryingNearingExpiryAssets,
    logNearingExpiryAssetsRetrieved,
    
    // Expired assets operations
    logGetExpiredAssetsApiCalled,
    logQueryingExpiredAssets,
    logExpiredAssetsRetrieved,
    
    // Category assets operations
    logGetCategoryAssetsApiCalled,
    logQueryingCategoryAssets,
    logCategoryAssetsRetrieved,
    
    // Database error handling
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation,
    logDataRetrievalError
};
