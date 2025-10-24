const eventLogger = require('../services/eventLogger');
const APP_ID = 'ASSETS'; // Using ASSETS app_id since depreciation is part of asset management

/**
 * Depreciation Event Logger
 * Comprehensive logging for all depreciation operations
 * Part of the asset management system
 */

// ===== GENERAL LOGGING FUNCTIONS =====

async function logApiCall(options) {
    const { appId = APP_ID, eventType, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId,
        logLevel: 'INFO',
        eventType,
        module: 'DepreciationController',
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
        module: 'DepreciationController',
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
        module: 'DepreciationController',
        message: `ERROR: ${eventType} failed`,
        requestData,
        responseData: { error: error.message || error },
        userId,
        duration
    });
}

// ===== SINGLE ASSET DEPRECIATION OPERATIONS =====

async function logCalculateAssetDepreciationApiCalled(options) {
    const { assetId, calculationDate, orgId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CALCULATE_ASSET_DEPRECIATION_API_CALLED',
        module: 'DepreciationController',
        message: 'INFO: Calculate asset depreciation API called',
        requestData: { assetId, calculationDate, orgId, ...requestData },
        userId,
        duration
    });
}

async function logFetchingAssetDepreciationInfo(options) {
    const { assetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'FETCHING_ASSET_DEPRECIATION_INFO',
        module: 'DepreciationController',
        message: 'INFO: Fetching asset depreciation information',
        requestData: { assetId, operation: 'fetch_asset_depreciation_info' },
        userId
    });
}

async function logAssetNotFound(options) {
    const { assetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'ASSET_NOT_FOUND',
        module: 'DepreciationController',
        message: 'WARNING: Asset not found for depreciation calculation',
        requestData: { assetId, message: 'The specified asset does not exist' },
        userId
    });
}

async function logAssetNotEligibleForDepreciation(options) {
    const { assetId, depreciationType, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'ASSET_NOT_ELIGIBLE_FOR_DEPRECIATION',
        module: 'DepreciationController',
        message: 'WARNING: Asset not eligible for depreciation',
        requestData: { assetId, depreciationType, message: 'Asset type is set to "No Depreciation"' },
        userId
    });
}

async function logInvalidAssetCost(options) {
    const { assetId, purchasedCost, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'INVALID_ASSET_COST',
        module: 'DepreciationController',
        message: 'WARNING: Invalid asset cost for depreciation',
        requestData: { assetId, purchasedCost, message: 'Asset must have a valid purchase cost' },
        userId
    });
}

async function logValidatingDepreciationParams(options) {
    const { assetId, originalCost, salvageValue, usefulLifeYears, depreciationMethod, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_DEPRECIATION_PARAMS',
        module: 'DepreciationController',
        message: 'INFO: Validating depreciation parameters',
        requestData: { assetId, originalCost, salvageValue, usefulLifeYears, depreciationMethod, operation: 'validating_parameters' },
        userId
    });
}

async function logDepreciationParamsInvalid(options) {
    const { assetId, errors, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'DEPRECIATION_PARAMS_INVALID',
        module: 'DepreciationController',
        message: 'WARNING: Invalid depreciation parameters',
        requestData: { assetId, errors, message: 'Invalid depreciation parameters provided' },
        userId
    });
}

async function logCalculatingDepreciation(options) {
    const { assetId, depreciationMethod, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CALCULATING_DEPRECIATION',
        module: 'DepreciationController',
        message: 'INFO: Calculating depreciation',
        requestData: { assetId, depreciationMethod, operation: 'calculating_depreciation' },
        userId
    });
}

async function logDepreciationMethodNotSupported(options) {
    const { assetId, depreciationMethod, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DEPRECIATION_METHOD_NOT_SUPPORTED',
        module: 'DepreciationController',
        message: 'ERROR: Depreciation method not supported',
        requestData: { assetId, depreciationMethod, message: `Depreciation method '${depreciationMethod}' is not supported` },
        userId
    });
}

async function logDepreciationCalculated(options) {
    const { assetId, depreciationAmount, bookValueBefore, bookValueAfter, depreciationMethod, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DEPRECIATION_CALCULATED',
        module: 'DepreciationController',
        message: 'INFO: Depreciation calculated successfully',
        requestData: { assetId, depreciationAmount, bookValueBefore, bookValueAfter, depreciationMethod },
        userId
    });
}

async function logInsertingDepreciationRecord(options) {
    const { assetId, depreciationAmount, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'INSERTING_DEPRECIATION_RECORD',
        module: 'DepreciationController',
        message: 'INFO: Inserting depreciation record',
        requestData: { assetId, depreciationAmount, operation: 'insert_depreciation_record' },
        userId
    });
}

async function logDepreciationRecordInserted(options) {
    const { assetId, recordId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DEPRECIATION_RECORD_INSERTED',
        module: 'DepreciationController',
        message: 'INFO: Depreciation record inserted successfully',
        requestData: { assetId, recordId },
        userId
    });
}

async function logUpdatingAssetDepreciation(options) {
    const { assetId, bookValueAfter, accumulatedDepreciation, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPDATING_ASSET_DEPRECIATION',
        module: 'DepreciationController',
        message: 'INFO: Updating asset depreciation values',
        requestData: { assetId, bookValueAfter, accumulatedDepreciation, operation: 'update_asset_depreciation' },
        userId
    });
}

async function logAssetDepreciationUpdated(options) {
    const { assetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSET_DEPRECIATION_UPDATED',
        module: 'DepreciationController',
        message: 'INFO: Asset depreciation values updated successfully',
        requestData: { assetId },
        userId
    });
}

async function logAssetDepreciationCalculationError(options) {
    const { assetId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ASSET_DEPRECIATION_CALCULATION_ERROR',
        module: 'DepreciationController',
        message: 'ERROR: Asset depreciation calculation failed',
        requestData: { assetId, error: error.message || error },
        userId
    });
}

// ===== BULK DEPRECIATION OPERATIONS =====

async function logCalculateBulkDepreciationApiCalled(options) {
    const { orgId, calculationDate, assetIds, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CALCULATE_BULK_DEPRECIATION_API_CALLED',
        module: 'DepreciationController',
        message: 'INFO: Calculate bulk depreciation API called',
        requestData: { orgId, calculationDate, assetIds, ...requestData },
        userId,
        duration
    });
}

async function logMissingOrgId(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_ORG_ID',
        module: 'DepreciationController',
        message: 'WARNING: Organization ID required',
        requestData: { message: 'org_id is required for bulk depreciation calculation' },
        userId
    });
}

async function logFetchingAssetsForDepreciation(options) {
    const { orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'FETCHING_ASSETS_FOR_DEPRECIATION',
        module: 'DepreciationController',
        message: 'INFO: Fetching assets for depreciation',
        requestData: { orgId, operation: 'fetch_assets_for_depreciation' },
        userId
    });
}

async function logAssetsRetrievedForDepreciation(options) {
    const { orgId, count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSETS_RETRIEVED_FOR_DEPRECIATION',
        module: 'DepreciationController',
        message: `INFO: Retrieved ${count} assets for depreciation`,
        requestData: { orgId, count },
        userId
    });
}

async function logProcessingBulkDepreciation(options) {
    const { orgId, totalAssets, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'PROCESSING_BULK_DEPRECIATION',
        module: 'DepreciationController',
        message: 'INFO: Processing bulk depreciation calculation',
        requestData: { orgId, totalAssets, operation: 'process_bulk_depreciation' },
        userId
    });
}

async function logBulkDepreciationCompleted(options) {
    const { orgId, totalAssets, successful, failed, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'BULK_DEPRECIATION_COMPLETED',
        module: 'DepreciationController',
        message: 'INFO: Bulk depreciation calculation completed',
        requestData: { orgId, totalAssets, successful, failed },
        userId,
        duration
    });
}

async function logBulkDepreciationError(options) {
    const { orgId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'BULK_DEPRECIATION_ERROR',
        module: 'DepreciationController',
        message: 'ERROR: Bulk depreciation calculation failed',
        requestData: { orgId, error: error.message || error },
        userId
    });
}

// ===== DEPRECIATION HISTORY OPERATIONS =====

async function logGetAssetDepreciationHistoryApiCalled(options) {
    const { assetId, limit, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_ASSET_DEPRECIATION_HISTORY_API_CALLED',
        module: 'DepreciationController',
        message: 'INFO: Get asset depreciation history API called',
        requestData: { assetId, limit, ...requestData },
        userId,
        duration
    });
}

async function logQueryingDepreciationHistory(options) {
    const { assetId, limit, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_DEPRECIATION_HISTORY',
        module: 'DepreciationController',
        message: 'INFO: Querying depreciation history',
        requestData: { assetId, limit, operation: 'query_depreciation_history' },
        userId
    });
}

async function logDepreciationHistoryRetrieved(options) {
    const { assetId, count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DEPRECIATION_HISTORY_RETRIEVED',
        module: 'DepreciationController',
        message: `INFO: Retrieved ${count} depreciation history records`,
        requestData: { assetId, count },
        userId
    });
}

async function logDepreciationHistoryError(options) {
    const { assetId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DEPRECIATION_HISTORY_ERROR',
        module: 'DepreciationController',
        message: 'ERROR: Failed to get depreciation history',
        requestData: { assetId, error: error.message || error },
        userId
    });
}

// ===== DEPRECIATION SUMMARY OPERATIONS =====

async function logGetDepreciationSummaryApiCalled(options) {
    const { orgId, dateFrom, dateTo, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_DEPRECIATION_SUMMARY_API_CALLED',
        module: 'DepreciationController',
        message: 'INFO: Get depreciation summary API called',
        requestData: { orgId, dateFrom, dateTo, ...requestData },
        userId,
        duration
    });
}

async function logQueryingDepreciationSummary(options) {
    const { orgId, dateFrom, dateTo, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_DEPRECIATION_SUMMARY',
        module: 'DepreciationController',
        message: 'INFO: Querying depreciation summary',
        requestData: { orgId, dateFrom, dateTo, operation: 'query_depreciation_summary' },
        userId
    });
}

async function logDepreciationSummaryRetrieved(options) {
    const { orgId, summary, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DEPRECIATION_SUMMARY_RETRIEVED',
        module: 'DepreciationController',
        message: 'INFO: Depreciation summary retrieved successfully',
        requestData: { orgId, summary },
        userId
    });
}

async function logDepreciationSummaryError(options) {
    const { orgId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DEPRECIATION_SUMMARY_ERROR',
        module: 'DepreciationController',
        message: 'ERROR: Failed to get depreciation summary',
        requestData: { orgId, error: error.message || error },
        userId
    });
}

// ===== ASSETS BY DEPRECIATION METHOD OPERATIONS =====

async function logGetAssetsByDepreciationMethodApiCalled(options) {
    const { orgId, method, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_ASSETS_BY_DEPRECIATION_METHOD_API_CALLED',
        module: 'DepreciationController',
        message: 'INFO: Get assets by depreciation method API called',
        requestData: { orgId, method, ...requestData },
        userId,
        duration
    });
}

async function logInvalidDepreciationMethod(options) {
    const { method, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'INVALID_DEPRECIATION_METHOD',
        module: 'DepreciationController',
        message: 'WARNING: Invalid depreciation method',
        requestData: { method, message: 'Depreciation method must be one of: ND, SL, RB, DD' },
        userId
    });
}

async function logQueryingAssetsByDepreciationMethod(options) {
    const { orgId, method, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_ASSETS_BY_DEPRECIATION_METHOD',
        module: 'DepreciationController',
        message: 'INFO: Querying assets by depreciation method',
        requestData: { orgId, method, operation: 'query_assets_by_depreciation_method' },
        userId
    });
}

async function logAssetsByDepreciationMethodRetrieved(options) {
    const { orgId, method, count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSETS_BY_DEPRECIATION_METHOD_RETRIEVED',
        module: 'DepreciationController',
        message: `INFO: Retrieved ${count} assets for depreciation method ${method}`,
        requestData: { orgId, method, count },
        userId
    });
}

async function logAssetsByDepreciationMethodError(options) {
    const { orgId, method, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ASSETS_BY_DEPRECIATION_METHOD_ERROR',
        module: 'DepreciationController',
        message: 'ERROR: Failed to get assets by depreciation method',
        requestData: { orgId, method, error: error.message || error },
        userId
    });
}

// ===== DEPRECIATION SETTINGS OPERATIONS =====

async function logGetDepreciationSettingsApiCalled(options) {
    const { orgId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_DEPRECIATION_SETTINGS_API_CALLED',
        module: 'DepreciationController',
        message: 'INFO: Get depreciation settings API called',
        requestData: { orgId, ...requestData },
        userId,
        duration
    });
}

async function logQueryingDepreciationSettings(options) {
    const { orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_DEPRECIATION_SETTINGS',
        module: 'DepreciationController',
        message: 'INFO: Querying depreciation settings',
        requestData: { orgId, operation: 'query_depreciation_settings' },
        userId
    });
}

async function logDepreciationSettingsRetrieved(options) {
    const { orgId, settings, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DEPRECIATION_SETTINGS_RETRIEVED',
        module: 'DepreciationController',
        message: 'INFO: Depreciation settings retrieved successfully',
        requestData: { orgId, settings },
        userId
    });
}

async function logDepreciationSettingsError(options) {
    const { orgId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DEPRECIATION_SETTINGS_ERROR',
        module: 'DepreciationController',
        message: 'ERROR: Failed to get depreciation settings',
        requestData: { orgId, error: error.message || error },
        userId
    });
}

async function logUpdateDepreciationSettingsApiCalled(options) {
    const { settingId, updateData, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPDATE_DEPRECIATION_SETTINGS_API_CALLED',
        module: 'DepreciationController',
        message: 'INFO: Update depreciation settings API called',
        requestData: { settingId, updateData, ...requestData },
        userId,
        duration
    });
}

async function logUpdatingDepreciationSettings(options) {
    const { settingId, updateData, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPDATING_DEPRECIATION_SETTINGS',
        module: 'DepreciationController',
        message: 'INFO: Updating depreciation settings',
        requestData: { settingId, updateData, operation: 'update_depreciation_settings' },
        userId
    });
}

async function logDepreciationSettingsUpdated(options) {
    const { settingId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DEPRECIATION_SETTINGS_UPDATED',
        module: 'DepreciationController',
        message: 'INFO: Depreciation settings updated successfully',
        requestData: { settingId },
        userId
    });
}

async function logDepreciationSettingsUpdateError(options) {
    const { settingId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DEPRECIATION_SETTINGS_UPDATE_ERROR',
        module: 'DepreciationController',
        message: 'ERROR: Failed to update depreciation settings',
        requestData: { settingId, error: error.message || error },
        userId
    });
}

// ===== DEPRECIATION SCHEDULE OPERATIONS =====

async function logGenerateDepreciationScheduleApiCalled(options) {
    const { assetId, orgId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GENERATE_DEPRECIATION_SCHEDULE_API_CALLED',
        module: 'DepreciationController',
        message: 'INFO: Generate depreciation schedule API called',
        requestData: { assetId, orgId, ...requestData },
        userId,
        duration
    });
}

async function logFetchingAssetForSchedule(options) {
    const { assetId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'FETCHING_ASSET_FOR_SCHEDULE',
        module: 'DepreciationController',
        message: 'INFO: Fetching asset information for schedule generation',
        requestData: { assetId, operation: 'fetch_asset_for_schedule' },
        userId
    });
}

async function logAssetNotEligibleForSchedule(options) {
    const { assetId, depreciationType, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'ASSET_NOT_ELIGIBLE_FOR_SCHEDULE',
        module: 'DepreciationController',
        message: 'WARNING: Asset not eligible for depreciation schedule',
        requestData: { assetId, depreciationType, message: 'Asset type is set to "No Depreciation"' },
        userId
    });
}

async function logGeneratingDepreciationSchedule(options) {
    const { assetId, originalCost, salvageValue, usefulLifeYears, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GENERATING_DEPRECIATION_SCHEDULE',
        module: 'DepreciationController',
        message: 'INFO: Generating depreciation schedule',
        requestData: { assetId, originalCost, salvageValue, usefulLifeYears, operation: 'generate_schedule' },
        userId
    });
}

async function logDepreciationScheduleGenerated(options) {
    const { assetId, scheduleLength, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DEPRECIATION_SCHEDULE_GENERATED',
        module: 'DepreciationController',
        message: 'INFO: Depreciation schedule generated successfully',
        requestData: { assetId, scheduleLength },
        userId
    });
}

async function logDepreciationScheduleError(options) {
    const { assetId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DEPRECIATION_SCHEDULE_ERROR',
        module: 'DepreciationController',
        message: 'ERROR: Failed to generate depreciation schedule',
        requestData: { assetId, error: error.message || error },
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
        module: 'DepreciationController',
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
        module: 'DepreciationController',
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
        module: 'DepreciationController',
        message: 'ERROR: Database transaction rolled back',
        requestData: { operation, error: error.message || error },
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
        module: 'DepreciationController',
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
        module: 'DepreciationController',
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
        module: 'DepreciationController',
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
    
    // Single asset depreciation operations
    logCalculateAssetDepreciationApiCalled,
    logFetchingAssetDepreciationInfo,
    logAssetNotFound,
    logAssetNotEligibleForDepreciation,
    logInvalidAssetCost,
    logValidatingDepreciationParams,
    logDepreciationParamsInvalid,
    logCalculatingDepreciation,
    logDepreciationMethodNotSupported,
    logDepreciationCalculated,
    logInsertingDepreciationRecord,
    logDepreciationRecordInserted,
    logUpdatingAssetDepreciation,
    logAssetDepreciationUpdated,
    logAssetDepreciationCalculationError,
    
    // Bulk depreciation operations
    logCalculateBulkDepreciationApiCalled,
    logMissingOrgId,
    logFetchingAssetsForDepreciation,
    logAssetsRetrievedForDepreciation,
    logProcessingBulkDepreciation,
    logBulkDepreciationCompleted,
    logBulkDepreciationError,
    
    // Depreciation history operations
    logGetAssetDepreciationHistoryApiCalled,
    logQueryingDepreciationHistory,
    logDepreciationHistoryRetrieved,
    logDepreciationHistoryError,
    
    // Depreciation summary operations
    logGetDepreciationSummaryApiCalled,
    logQueryingDepreciationSummary,
    logDepreciationSummaryRetrieved,
    logDepreciationSummaryError,
    
    // Assets by depreciation method operations
    logGetAssetsByDepreciationMethodApiCalled,
    logInvalidDepreciationMethod,
    logQueryingAssetsByDepreciationMethod,
    logAssetsByDepreciationMethodRetrieved,
    logAssetsByDepreciationMethodError,
    
    // Depreciation settings operations
    logGetDepreciationSettingsApiCalled,
    logQueryingDepreciationSettings,
    logDepreciationSettingsRetrieved,
    logDepreciationSettingsError,
    logUpdateDepreciationSettingsApiCalled,
    logUpdatingDepreciationSettings,
    logDepreciationSettingsUpdated,
    logDepreciationSettingsUpdateError,
    
    // Depreciation schedule operations
    logGenerateDepreciationScheduleApiCalled,
    logFetchingAssetForSchedule,
    logAssetNotEligibleForSchedule,
    logGeneratingDepreciationSchedule,
    logDepreciationScheduleGenerated,
    logDepreciationScheduleError,
    
    // Database operations
    logDatabaseTransactionStarted,
    logDatabaseTransactionCompleted,
    logDatabaseTransactionRollback,
    
    // Database error handling
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation,
    logDataRetrievalError
};
