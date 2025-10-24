const eventLogger = require('../services/eventLogger');
const APP_ID = 'GROUPASSET'; // Dedicated app_id for asset group operations

/**
 * Asset Group Event Logger
 * Comprehensive logging for all asset group operations
 * Uses GROUPASSET app_id for dedicated CSV file
 */

// ===== GENERAL LOGGING FUNCTIONS =====

async function logApiCall(options) {
    const { appId = APP_ID, eventType, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId,
        logLevel: 'INFO',
        eventType,
        module: 'AssetGroupController',
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
        module: 'AssetGroupController',
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
        module: 'AssetGroupController',
        message: `ERROR: ${eventType} failed`,
        requestData,
        responseData: { error: error.message || error },
        userId,
        duration
    });
}

// ===== ASSET GROUP CRUD OPERATIONS =====

async function logCreateAssetGroupApiCalled(options) {
    const { text, assetIds, orgId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CREATE_ASSET_GROUP_API_CALLED',
        module: 'AssetGroupController',
        message: 'INFO: POST /api/asset-groups - Create asset group API called',
        requestData: { text, assetIds, orgId, ...requestData },
        userId,
        duration
    });
}

async function logValidatingAssetGroupData(options) {
    const { text, assetIds, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_ASSET_GROUP_DATA',
        module: 'AssetGroupController',
        message: 'INFO: Validating asset group data',
        requestData: { text, assetIds, operation: 'validating_data' },
        userId
    });
}

async function logMissingGroupName(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_GROUP_NAME',
        module: 'AssetGroupController',
        message: 'WARNING: Group name is required',
        requestData: { message: 'Group name (text) is required' },
        userId
    });
}

async function logMissingAssetIds(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_ASSET_IDS',
        module: 'AssetGroupController',
        message: 'WARNING: At least one asset must be selected',
        requestData: { message: 'At least one asset must be selected' },
        userId
    });
}

async function logCreatingAssetGroup(options) {
    const { text, assetIds, orgId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CREATING_ASSET_GROUP',
        module: 'AssetGroupController',
        message: 'INFO: Creating asset group',
        requestData: { text, assetIds, orgId, operation: 'creating_asset_group' },
        userId
    });
}

async function logAssetGroupCreated(options) {
    const { assetGroupId, text, assetCount, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSET_GROUP_CREATED',
        module: 'AssetGroupController',
        message: 'INFO: Asset group created successfully',
        requestData: { assetGroupId, text, assetCount },
        userId,
        duration
    });
}

async function logAssetGroupCreationError(options) {
    const { text, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ASSET_GROUP_CREATION_ERROR',
        module: 'AssetGroupController',
        message: 'ERROR: Asset group creation failed',
        requestData: { text, error: error.message || error },
        userId
    });
}

async function logGetAllAssetGroupsApiCalled(options) {
    const { requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_ALL_ASSET_GROUPS_API_CALLED',
        module: 'AssetGroupController',
        message: 'INFO: GET /api/asset-groups - Get all asset groups API called',
        requestData,
        userId,
        duration
    });
}

async function logQueryingAssetGroups(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_ASSET_GROUPS',
        module: 'AssetGroupController',
        message: 'INFO: Querying asset groups',
        requestData: { operation: 'query_asset_groups' },
        userId
    });
}

async function logAssetGroupsRetrieved(options) {
    const { count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSET_GROUPS_RETRIEVED',
        module: 'AssetGroupController',
        message: `INFO: Retrieved ${count} asset groups`,
        requestData: { count },
        userId
    });
}

async function logAssetGroupsRetrievalError(options) {
    const { error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ASSET_GROUPS_RETRIEVAL_ERROR',
        module: 'AssetGroupController',
        message: 'ERROR: Failed to retrieve asset groups',
        requestData: { error: error.message || error },
        userId
    });
}

async function logGetAssetGroupByIdApiCalled(options) {
    const { assetGroupId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_ASSET_GROUP_BY_ID_API_CALLED',
        module: 'AssetGroupController',
        message: 'INFO: GET /api/asset-groups/:id - Get asset group by ID API called',
        requestData: { assetGroupId, ...requestData },
        userId,
        duration
    });
}

async function logQueryingAssetGroupById(options) {
    const { assetGroupId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_ASSET_GROUP_BY_ID',
        module: 'AssetGroupController',
        message: 'INFO: Querying asset group by ID',
        requestData: { assetGroupId, operation: 'query_asset_group_by_id' },
        userId
    });
}

async function logAssetGroupNotFound(options) {
    const { assetGroupId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'ASSET_GROUP_NOT_FOUND',
        module: 'AssetGroupController',
        message: 'WARNING: Asset group not found',
        requestData: { assetGroupId, message: 'Asset group not found' },
        userId
    });
}

async function logAssetGroupRetrieved(options) {
    const { assetGroupId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSET_GROUP_RETRIEVED',
        module: 'AssetGroupController',
        message: 'INFO: Asset group retrieved successfully',
        requestData: { assetGroupId },
        userId
    });
}

async function logAssetGroupRetrievalError(options) {
    const { assetGroupId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ASSET_GROUP_RETRIEVAL_ERROR',
        module: 'AssetGroupController',
        message: 'ERROR: Failed to retrieve asset group',
        requestData: { assetGroupId, error: error.message || error },
        userId
    });
}

async function logUpdateAssetGroupApiCalled(options) {
    const { assetGroupId, text, assetIds, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPDATE_ASSET_GROUP_API_CALLED',
        module: 'AssetGroupController',
        message: 'INFO: PUT /api/asset-groups/:id - Update asset group API called',
        requestData: { assetGroupId, text, assetIds, ...requestData },
        userId,
        duration
    });
}

async function logValidatingUpdateData(options) {
    const { assetGroupId, text, assetIds, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_UPDATE_DATA',
        module: 'AssetGroupController',
        message: 'INFO: Validating update data',
        requestData: { assetGroupId, text, assetIds, operation: 'validating_update_data' },
        userId
    });
}

async function logCheckingAssetGroupExists(options) {
    const { assetGroupId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CHECKING_ASSET_GROUP_EXISTS',
        module: 'AssetGroupController',
        message: 'INFO: Checking if asset group exists',
        requestData: { assetGroupId, operation: 'check_asset_group_exists' },
        userId
    });
}

async function logUpdatingAssetGroup(options) {
    const { assetGroupId, text, assetIds, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPDATING_ASSET_GROUP',
        module: 'AssetGroupController',
        message: 'INFO: Updating asset group',
        requestData: { assetGroupId, text, assetIds, operation: 'update_asset_group' },
        userId
    });
}

async function logAssetGroupUpdated(options) {
    const { assetGroupId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSET_GROUP_UPDATED',
        module: 'AssetGroupController',
        message: 'INFO: Asset group updated successfully',
        requestData: { assetGroupId },
        userId,
        duration
    });
}

async function logAssetGroupUpdateError(options) {
    const { assetGroupId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ASSET_GROUP_UPDATE_ERROR',
        module: 'AssetGroupController',
        message: 'ERROR: Asset group update failed',
        requestData: { assetGroupId, error: error.message || error },
        userId
    });
}

async function logDeleteAssetGroupApiCalled(options) {
    const { assetGroupId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DELETE_ASSET_GROUP_API_CALLED',
        module: 'AssetGroupController',
        message: 'INFO: DELETE /api/asset-groups/:id - Delete asset group API called',
        requestData: { assetGroupId, ...requestData },
        userId,
        duration
    });
}

async function logDeletingAssetGroup(options) {
    const { assetGroupId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DELETING_ASSET_GROUP',
        module: 'AssetGroupController',
        message: 'INFO: Deleting asset group',
        requestData: { assetGroupId, operation: 'delete_asset_group' },
        userId
    });
}

async function logAssetGroupDeleted(options) {
    const { assetGroupId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ASSET_GROUP_DELETED',
        module: 'AssetGroupController',
        message: 'INFO: Asset group deleted successfully',
        requestData: { assetGroupId },
        userId,
        duration
    });
}

async function logAssetGroupDeletionError(options) {
    const { assetGroupId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ASSET_GROUP_DELETION_ERROR',
        module: 'AssetGroupController',
        message: 'ERROR: Asset group deletion failed',
        requestData: { assetGroupId, error: error.message || error },
        userId
    });
}

// ===== ASSET GROUP DOCUMENTS OPERATIONS =====

async function logUploadAssetGroupDocApiCalled(options) {
    const { assetGroupId, fileName, fileSize, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPLOAD_ASSET_GROUP_DOC_API_CALLED',
        module: 'AssetGroupDocsController',
        message: 'INFO: POST /api/asset-group-docs/upload - Upload asset group document API called',
        requestData: { assetGroupId, fileName, fileSize, ...requestData },
        userId,
        duration
    });
}

async function logValidatingUploadData(options) {
    const { assetGroupId, fileName, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_UPLOAD_DATA',
        module: 'AssetGroupDocsController',
        message: 'INFO: Validating upload data',
        requestData: { assetGroupId, fileName, operation: 'validating_upload_data' },
        userId
    });
}

async function logMissingFile(options) {
    const { userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_FILE',
        module: 'AssetGroupDocsController',
        message: 'WARNING: File is required',
        requestData: { message: 'File is required' },
        userId
    });
}

async function logMissingRequiredFields(options) {
    const { missingFields, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'MISSING_REQUIRED_FIELDS',
        module: 'AssetGroupDocsController',
        message: 'WARNING: Required fields are missing',
        requestData: { missingFields, message: 'Required fields are missing' },
        userId
    });
}

async function logCheckingAssetGroupExists(options) {
    const { assetGroupId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'CHECKING_ASSET_GROUP_EXISTS',
        module: 'AssetGroupDocsController',
        message: 'INFO: Checking if asset group exists',
        requestData: { assetGroupId, operation: 'check_asset_group_exists' },
        userId
    });
}

async function logUploadingToMinio(options) {
    const { assetGroupId, fileName, objectName, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPLOADING_TO_MINIO',
        module: 'AssetGroupDocsController',
        message: 'INFO: Uploading file to MinIO',
        requestData: { assetGroupId, fileName, objectName, operation: 'upload_to_minio' },
        userId
    });
}

async function logFileUploadedToMinio(options) {
    const { assetGroupId, fileName, objectName, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'FILE_UPLOADED_TO_MINIO',
        module: 'AssetGroupDocsController',
        message: 'INFO: File uploaded to MinIO successfully',
        requestData: { assetGroupId, fileName, objectName },
        userId
    });
}

async function logInsertingDocumentRecord(options) {
    const { assetGroupId, docId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'INSERTING_DOCUMENT_RECORD',
        module: 'AssetGroupDocsController',
        message: 'INFO: Inserting document record',
        requestData: { assetGroupId, docId, operation: 'insert_document_record' },
        userId
    });
}

async function logDocumentRecordInserted(options) {
    const { assetGroupId, docId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DOCUMENT_RECORD_INSERTED',
        module: 'AssetGroupDocsController',
        message: 'INFO: Document record inserted successfully',
        requestData: { assetGroupId, docId },
        userId
    });
}

async function logDocumentUploaded(options) {
    const { assetGroupId, docId, fileName, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DOCUMENT_UPLOADED',
        module: 'AssetGroupDocsController',
        message: 'INFO: Document uploaded successfully',
        requestData: { assetGroupId, docId, fileName },
        userId,
        duration
    });
}

async function logDocumentUploadError(options) {
    const { assetGroupId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DOCUMENT_UPLOAD_ERROR',
        module: 'AssetGroupDocsController',
        message: 'ERROR: Document upload failed',
        requestData: { assetGroupId, error: error.message || error },
        userId
    });
}

async function logListDocsApiCalled(options) {
    const { assetGroupId, dtoId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'LIST_DOCS_API_CALLED',
        module: 'AssetGroupDocsController',
        message: 'INFO: GET /api/asset-group-docs/:asset_group_id - List documents API called',
        requestData: { assetGroupId, dtoId, ...requestData },
        userId,
        duration
    });
}

async function logQueryingDocuments(options) {
    const { assetGroupId, dtoId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'QUERYING_DOCUMENTS',
        module: 'AssetGroupDocsController',
        message: 'INFO: Querying documents',
        requestData: { assetGroupId, dtoId, operation: 'query_documents' },
        userId
    });
}

async function logDocumentsRetrieved(options) {
    const { assetGroupId, count, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DOCUMENTS_RETRIEVED',
        module: 'AssetGroupDocsController',
        message: `INFO: Retrieved ${count} documents`,
        requestData: { assetGroupId, count },
        userId
    });
}

async function logDocumentsRetrievalError(options) {
    const { assetGroupId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DOCUMENTS_RETRIEVAL_ERROR',
        module: 'AssetGroupDocsController',
        message: 'ERROR: Failed to retrieve documents',
        requestData: { assetGroupId, error: error.message || error },
        userId
    });
}

async function logGetDownloadUrlApiCalled(options) {
    const { docId, mode, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GET_DOWNLOAD_URL_API_CALLED',
        module: 'AssetGroupDocsController',
        message: 'INFO: GET /api/asset-group-docs/:agd_id/download - Get download URL API called',
        requestData: { docId, mode, ...requestData },
        userId,
        duration
    });
}

async function logGeneratingDownloadUrl(options) {
    const { docId, mode, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'GENERATING_DOWNLOAD_URL',
        module: 'AssetGroupDocsController',
        message: 'INFO: Generating download URL',
        requestData: { docId, mode, operation: 'generate_download_url' },
        userId
    });
}

async function logDownloadUrlGenerated(options) {
    const { docId, mode, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DOWNLOAD_URL_GENERATED',
        module: 'AssetGroupDocsController',
        message: 'INFO: Download URL generated successfully',
        requestData: { docId, mode },
        userId
    });
}

async function logDownloadUrlError(options) {
    const { docId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DOWNLOAD_URL_ERROR',
        module: 'AssetGroupDocsController',
        message: 'ERROR: Failed to generate download URL',
        requestData: { docId, error: error.message || error },
        userId
    });
}

async function logArchiveDocApiCalled(options) {
    const { docId, archivedPath, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ARCHIVE_DOC_API_CALLED',
        module: 'AssetGroupDocsController',
        message: 'INFO: POST /api/asset-group-docs/:agd_id/archive - Archive document API called',
        requestData: { docId, archivedPath, ...requestData },
        userId,
        duration
    });
}

async function logArchivingDocument(options) {
    const { docId, archivedPath, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ARCHIVING_DOCUMENT',
        module: 'AssetGroupDocsController',
        message: 'INFO: Archiving document',
        requestData: { docId, archivedPath, operation: 'archive_document' },
        userId
    });
}

async function logDocumentArchived(options) {
    const { docId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DOCUMENT_ARCHIVED',
        module: 'AssetGroupDocsController',
        message: 'INFO: Document archived successfully',
        requestData: { docId },
        userId,
        duration
    });
}

async function logDocumentArchiveError(options) {
    const { docId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DOCUMENT_ARCHIVE_ERROR',
        module: 'AssetGroupDocsController',
        message: 'ERROR: Document archive failed',
        requestData: { docId, error: error.message || error },
        userId
    });
}

async function logDeleteDocApiCalled(options) {
    const { docId, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DELETE_DOC_API_CALLED',
        module: 'AssetGroupDocsController',
        message: 'INFO: DELETE /api/asset-group-docs/:agd_id - Delete document API called',
        requestData: { docId, ...requestData },
        userId,
        duration
    });
}

async function logDeletingDocument(options) {
    const { docId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DELETING_DOCUMENT',
        module: 'AssetGroupDocsController',
        message: 'INFO: Deleting document',
        requestData: { docId, operation: 'delete_document' },
        userId
    });
}

async function logDocumentDeleted(options) {
    const { docId, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'DOCUMENT_DELETED',
        module: 'AssetGroupDocsController',
        message: 'INFO: Document deleted successfully',
        requestData: { docId },
        userId,
        duration
    });
}

async function logDocumentDeletionError(options) {
    const { docId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'DOCUMENT_DELETION_ERROR',
        module: 'AssetGroupDocsController',
        message: 'ERROR: Document deletion failed',
        requestData: { docId, error: error.message || error },
        userId
    });
}

async function logUpdateDocArchiveStatusApiCalled(options) {
    const { docId, isArchived, requestData, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'UPDATE_DOC_ARCHIVE_STATUS_API_CALLED',
        module: 'AssetGroupDocsController',
        message: 'INFO: PUT /api/asset-group-docs/:agd_id/archive-status - Update document archive status API called',
        requestData: { docId, isArchived, ...requestData },
        userId,
        duration
    });
}

async function logValidatingArchiveStatus(options) {
    const { docId, isArchived, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'VALIDATING_ARCHIVE_STATUS',
        module: 'AssetGroupDocsController',
        message: 'INFO: Validating archive status',
        requestData: { docId, isArchived, operation: 'validate_archive_status' },
        userId
    });
}

async function logInvalidArchiveStatus(options) {
    const { isArchived, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'WARNING',
        eventType: 'INVALID_ARCHIVE_STATUS',
        module: 'AssetGroupDocsController',
        message: 'WARNING: Invalid archive status',
        requestData: { isArchived, message: 'is_archived must be a boolean value' },
        userId
    });
}

async function logMovingFileToArchived(options) {
    const { docId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MOVING_FILE_TO_ARCHIVED',
        module: 'AssetGroupDocsController',
        message: 'INFO: Moving file to archived location',
        requestData: { docId, operation: 'move_file_to_archived' },
        userId
    });
}

async function logMovingFileFromArchived(options) {
    const { docId, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'MOVING_FILE_FROM_ARCHIVED',
        module: 'AssetGroupDocsController',
        message: 'INFO: Moving file from archived location',
        requestData: { docId, operation: 'move_file_from_archived' },
        userId
    });
}

async function logMinioOperationFailed(options) {
    const { docId, operation, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'MINIO_OPERATION_FAILED',
        module: 'AssetGroupDocsController',
        message: 'ERROR: MinIO operation failed',
        requestData: { docId, operation, error: error.message || error },
        userId
    });
}

async function logArchiveStatusUpdated(options) {
    const { docId, isArchived, userId, duration } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'INFO',
        eventType: 'ARCHIVE_STATUS_UPDATED',
        module: 'AssetGroupDocsController',
        message: 'INFO: Archive status updated successfully',
        requestData: { docId, isArchived },
        userId,
        duration
    });
}

async function logArchiveStatusUpdateError(options) {
    const { docId, error, userId } = options;
    await eventLogger.logEvent({
        appId: APP_ID,
        logLevel: 'ERROR',
        eventType: 'ARCHIVE_STATUS_UPDATE_ERROR',
        module: 'AssetGroupDocsController',
        message: 'ERROR: Archive status update failed',
        requestData: { docId, error: error.message || error },
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
        module: 'AssetGroupController',
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
        module: 'AssetGroupController',
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
        module: 'AssetGroupController',
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
        module: 'AssetGroupController',
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
        module: 'AssetGroupController',
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
        module: 'AssetGroupController',
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
    
    // Asset group CRUD operations
    logCreateAssetGroupApiCalled,
    logValidatingAssetGroupData,
    logMissingGroupName,
    logMissingAssetIds,
    logCreatingAssetGroup,
    logAssetGroupCreated,
    logAssetGroupCreationError,
    
    logGetAllAssetGroupsApiCalled,
    logQueryingAssetGroups,
    logAssetGroupsRetrieved,
    logAssetGroupsRetrievalError,
    
    logGetAssetGroupByIdApiCalled,
    logQueryingAssetGroupById,
    logAssetGroupNotFound,
    logAssetGroupRetrieved,
    logAssetGroupRetrievalError,
    
    logUpdateAssetGroupApiCalled,
    logValidatingUpdateData,
    logCheckingAssetGroupExists,
    logUpdatingAssetGroup,
    logAssetGroupUpdated,
    logAssetGroupUpdateError,
    
    logDeleteAssetGroupApiCalled,
    logDeletingAssetGroup,
    logAssetGroupDeleted,
    logAssetGroupDeletionError,
    
    // Asset group documents operations
    logUploadAssetGroupDocApiCalled,
    logValidatingUploadData,
    logMissingFile,
    logMissingRequiredFields,
    logCheckingAssetGroupExists,
    logUploadingToMinio,
    logFileUploadedToMinio,
    logInsertingDocumentRecord,
    logDocumentRecordInserted,
    logDocumentUploaded,
    logDocumentUploadError,
    
    logListDocsApiCalled,
    logQueryingDocuments,
    logDocumentsRetrieved,
    logDocumentsRetrievalError,
    
    logGetDownloadUrlApiCalled,
    logGeneratingDownloadUrl,
    logDownloadUrlGenerated,
    logDownloadUrlError,
    
    logArchiveDocApiCalled,
    logArchivingDocument,
    logDocumentArchived,
    logDocumentArchiveError,
    
    logDeleteDocApiCalled,
    logDeletingDocument,
    logDocumentDeleted,
    logDocumentDeletionError,
    
    logUpdateDocArchiveStatusApiCalled,
    logValidatingArchiveStatus,
    logInvalidArchiveStatus,
    logMovingFileToArchived,
    logMovingFileFromArchived,
    logMinioOperationFailed,
    logArchiveStatusUpdated,
    logArchiveStatusUpdateError,
    
    // Database operations
    logDatabaseTransactionStarted,
    logDatabaseTransactionCompleted,
    logDatabaseTransactionRollback,
    
    // Database error handling
    logDatabaseConnectionFailure,
    logDatabaseConstraintViolation,
    logDataRetrievalError
};
