# Asset Group Event Logging Implementation

## 📋 **Overview**

This document details the comprehensive event logging implementation for Asset Group operations using the `GROUPASSET` app_id. The logging covers all CRUD operations for asset groups and their associated document management.

## 🎯 **App ID Configuration**

**App ID**: `GROUPASSET`  
**CSV File**: `logs/events/events_GROUPASSET_YYYY-MM-DD.csv`  
**Log Levels**: INFO, WARNING, ERROR, CRITICAL

## 📁 **Files Modified**

### 1. **Event Logger**
- **File**: `AssetLifecycleBackend/eventLoggers/assetGroupEventLogger.js`
- **Purpose**: Comprehensive logging functions for all asset group operations
- **Functions**: 80+ logging functions covering CRUD operations, document management, and database operations

### 2. **Asset Group Controller**
- **File**: `AssetLifecycleBackend/controllers/assetGroupController.js`
- **Purpose**: Main asset group CRUD operations
- **APIs Covered**:
  - `POST /api/asset-groups` - Create asset group
  - `GET /api/asset-groups` - Get all asset groups
  - `GET /api/asset-groups/:id` - Get asset group by ID
  - `PUT /api/asset-groups/:id` - Update asset group
  - `DELETE /api/asset-groups/:id` - Delete asset group

### 3. **Asset Group Docs Controller**
- **File**: `AssetLifecycleBackend/controllers/assetGroupDocsController.js`
- **Purpose**: Document management for asset groups
- **APIs Covered**:
  - `POST /api/asset-group-docs/upload` - Upload document
  - `GET /api/asset-group-docs/:asset_group_id` - List documents
  - `GET /api/asset-group-docs/document/:agd_id` - Get document details
  - `GET /api/asset-group-docs/:agd_id/download` - Get download URL
  - `POST /api/asset-group-docs/:agd_id/archive` - Archive document
  - `DELETE /api/asset-group-docs/:agd_id` - Delete document
  - `PUT /api/asset-group-docs/:agd_id/archive-status` - Update archive status

## 🔧 **Logging Implementation Details**

### **Asset Group CRUD Operations**

#### **Create Asset Group**
```javascript
// API Call Logging
assetGroupLogger.logCreateAssetGroupApiCalled({
    text, assetIds, orgId, requestData, userId, duration
});

// Validation Logging
assetGroupLogger.logValidatingAssetGroupData({ text, assetIds, userId });
assetGroupLogger.logMissingGroupName({ userId });
assetGroupLogger.logMissingAssetIds({ userId });

// Process Logging
assetGroupLogger.logCreatingAssetGroup({ text, assetIds, orgId, userId });

// Success/Error Logging
assetGroupLogger.logAssetGroupCreated({ assetGroupId, text, assetCount, userId, duration });
assetGroupLogger.logAssetGroupCreationError({ text, error, userId });
```

#### **Get All Asset Groups**
```javascript
// API Call Logging
assetGroupLogger.logGetAllAssetGroupsApiCalled({ requestData, userId, duration });

// Process Logging
assetGroupLogger.logQueryingAssetGroups({ userId });
assetGroupLogger.logAssetGroupsRetrieved({ count, userId });

// Error Logging
assetGroupLogger.logAssetGroupsRetrievalError({ error, userId });
```

#### **Get Asset Group by ID**
```javascript
// API Call Logging
assetGroupLogger.logGetAssetGroupByIdApiCalled({ assetGroupId, requestData, userId, duration });

// Process Logging
assetGroupLogger.logQueryingAssetGroupById({ assetGroupId, userId });
assetGroupLogger.logAssetGroupNotFound({ assetGroupId, userId });
assetGroupLogger.logAssetGroupRetrieved({ assetGroupId, userId });

// Error Logging
assetGroupLogger.logAssetGroupRetrievalError({ assetGroupId, error, userId });
```

#### **Update Asset Group**
```javascript
// API Call Logging
assetGroupLogger.logUpdateAssetGroupApiCalled({ assetGroupId, text, assetIds, requestData, userId, duration });

// Validation Logging
assetGroupLogger.logValidatingUpdateData({ assetGroupId, text, assetIds, userId });
assetGroupLogger.logCheckingAssetGroupExists({ assetGroupId, userId });

// Process Logging
assetGroupLogger.logUpdatingAssetGroup({ assetGroupId, text, assetIds, userId });

// Success/Error Logging
assetGroupLogger.logAssetGroupUpdated({ assetGroupId, userId, duration });
assetGroupLogger.logAssetGroupUpdateError({ assetGroupId, error, userId });
```

#### **Delete Asset Group**
```javascript
// API Call Logging
assetGroupLogger.logDeleteAssetGroupApiCalled({ assetGroupId, requestData, userId, duration });

// Process Logging
assetGroupLogger.logCheckingAssetGroupExists({ assetGroupId, userId });
assetGroupLogger.logDeletingAssetGroup({ assetGroupId, userId });

// Success/Error Logging
assetGroupLogger.logAssetGroupDeleted({ assetGroupId, userId, duration });
assetGroupLogger.logAssetGroupDeletionError({ assetGroupId, error, userId });
```

### **Document Management Operations**

#### **Upload Document**
```javascript
// API Call Logging
assetGroupLogger.logUploadAssetGroupDocApiCalled({ assetGroupId, fileName, fileSize, requestData, userId, duration });

// Validation Logging
assetGroupLogger.logValidatingUploadData({ assetGroupId, fileName, userId });
assetGroupLogger.logMissingFile({ userId });
assetGroupLogger.logMissingRequiredFields({ missingFields, userId });

// Process Logging
assetGroupLogger.logCheckingAssetGroupExists({ assetGroupId, userId });
assetGroupLogger.logUploadingToMinio({ assetGroupId, fileName, objectName, userId });
assetGroupLogger.logFileUploadedToMinio({ assetGroupId, fileName, objectName, userId });
assetGroupLogger.logInsertingDocumentRecord({ assetGroupId, docId, userId });
assetGroupLogger.logDocumentRecordInserted({ assetGroupId, docId, userId });

// Success/Error Logging
assetGroupLogger.logDocumentUploaded({ assetGroupId, docId, fileName, userId, duration });
assetGroupLogger.logDocumentUploadError({ assetGroupId, error, userId });
```

#### **List Documents**
```javascript
// API Call Logging
assetGroupLogger.logListDocsApiCalled({ assetGroupId, dtoId, requestData, userId, duration });

// Process Logging
assetGroupLogger.logCheckingAssetGroupExists({ assetGroupId, userId });
assetGroupLogger.logQueryingDocuments({ assetGroupId, dtoId, userId });
assetGroupLogger.logDocumentsRetrieved({ assetGroupId, count, userId });

// Error Logging
assetGroupLogger.logDocumentsRetrievalError({ assetGroupId, error, userId });
```

#### **Get Download URL**
```javascript
// API Call Logging
assetGroupLogger.logGetDownloadUrlApiCalled({ docId, mode, requestData, userId, duration });

// Process Logging
assetGroupLogger.logGeneratingDownloadUrl({ docId, mode, userId });
assetGroupLogger.logDownloadUrlGenerated({ docId, mode, userId });

// Error Logging
assetGroupLogger.logDownloadUrlError({ docId, error, userId });
```

#### **Archive Document**
```javascript
// API Call Logging
assetGroupLogger.logArchiveDocApiCalled({ docId, archivedPath, requestData, userId, duration });

// Process Logging
assetGroupLogger.logArchivingDocument({ docId, archivedPath, userId });
assetGroupLogger.logDocumentArchived({ docId, userId, duration });

// Error Logging
assetGroupLogger.logDocumentArchiveError({ docId, error, userId });
```

#### **Delete Document**
```javascript
// API Call Logging
assetGroupLogger.logDeleteDocApiCalled({ docId, requestData, userId, duration });

// Process Logging
assetGroupLogger.logDeletingDocument({ docId, userId });
assetGroupLogger.logDocumentDeleted({ docId, userId, duration });

// Error Logging
assetGroupLogger.logDocumentDeletionError({ docId, error, userId });
```

#### **Update Archive Status**
```javascript
// API Call Logging
assetGroupLogger.logUpdateDocArchiveStatusApiCalled({ docId, isArchived, requestData, userId, duration });

// Validation Logging
assetGroupLogger.logValidatingArchiveStatus({ docId, isArchived, userId });
assetGroupLogger.logInvalidArchiveStatus({ isArchived, userId });

// Process Logging
assetGroupLogger.logMovingFileToArchived({ docId, userId });
assetGroupLogger.logMovingFileFromArchived({ docId, userId });
assetGroupLogger.logMinioOperationFailed({ docId, operation, error, userId });

// Success/Error Logging
assetGroupLogger.logArchiveStatusUpdated({ docId, isArchived, userId, duration });
assetGroupLogger.logArchiveStatusUpdateError({ docId, error, userId });
```

## 📊 **Log Levels and Event Types**

### **INFO Level Events**
- API calls and responses
- Data validation steps
- Database operations
- File operations (upload, download, archive)
- Success operations

### **WARNING Level Events**
- Missing required fields
- Invalid data types
- Asset group not found
- Document not found

### **ERROR Level Events**
- API operation failures
- Database connection issues
- File operation failures
- Validation errors

### **CRITICAL Level Events**
- Database connection failures
- System-level errors

## 🔍 **Sample Log Entries**

### **Asset Group Creation**
```csv
2025-10-23T10:30:00.000Z,INFO,CREATE_ASSET_GROUP_API_CALLED,AssetGroupController,"INFO: Create asset group API called","{\"text\":\"Office Equipment\",\"assetIds\":[\"ASS001\",\"ASS002\"],\"orgId\":\"ORG001\"}",,USR001,150
2025-10-23T10:30:00.100Z,INFO,VALIDATING_ASSET_GROUP_DATA,AssetGroupController,"INFO: Validating asset group data","{\"text\":\"Office Equipment\",\"assetIds\":[\"ASS001\",\"ASS002\"]}",,USR001,50
2025-10-23T10:30:00.200Z,INFO,CREATING_ASSET_GROUP,AssetGroupController,"INFO: Creating asset group","{\"text\":\"Office Equipment\",\"assetIds\":[\"ASS001\",\"ASS002\"],\"orgId\":\"ORG001\"}",,USR001,100
2025-10-23T10:30:00.500Z,INFO,ASSET_GROUP_CREATED,AssetGroupController,"INFO: Asset group created successfully","{\"assetGroupId\":\"AG001\",\"text\":\"Office Equipment\",\"assetCount\":2}",,USR001,300
```

### **Document Upload**
```csv
2025-10-23T10:35:00.000Z,INFO,UPLOAD_ASSET_GROUP_DOC_API_CALLED,AssetGroupDocsController,"INFO: Upload asset group document API called","{\"assetGroupId\":\"AG001\",\"fileName\":\"invoice.pdf\",\"fileSize\":1024000}",,USR001,200
2025-10-23T10:35:00.100Z,INFO,VALIDATING_UPLOAD_DATA,AssetGroupDocsController,"INFO: Validating upload data","{\"assetGroupId\":\"AG001\",\"fileName\":\"invoice.pdf\"}",,USR001,50
2025-10-23T10:35:00.200Z,INFO,UPLOADING_TO_MINIO,AssetGroupDocsController,"INFO: Uploading file to MinIO","{\"assetGroupId\":\"AG001\",\"fileName\":\"invoice.pdf\",\"objectName\":\"ORG001/asset-groups/AG001/1732340100000_abc123.pdf\"}",,USR001,100
2025-10-23T10:35:00.400Z,INFO,FILE_UPLOADED_TO_MINIO,AssetGroupDocsController,"INFO: File uploaded to MinIO successfully","{\"assetGroupId\":\"AG001\",\"fileName\":\"invoice.pdf\",\"objectName\":\"ORG001/asset-groups/AG001/1732340100000_abc123.pdf\"}",,USR001,200
2025-10-23T10:35:00.500Z,INFO,DOCUMENT_UPLOADED,AssetGroupDocsController,"INFO: Document uploaded successfully","{\"assetGroupId\":\"AG001\",\"docId\":\"AGD001\",\"fileName\":\"invoice.pdf\"}",,USR001,500
```

### **Archive Status Update**
```csv
2025-10-23T10:40:00.000Z,INFO,UPDATE_DOC_ARCHIVE_STATUS_API_CALLED,AssetGroupDocsController,"INFO: Update document archive status API called","{\"docId\":\"AGD001\",\"isArchived\":true}",,USR001,150
2025-10-23T10:40:00.100Z,INFO,VALIDATING_ARCHIVE_STATUS,AssetGroupDocsController,"INFO: Validating archive status","{\"docId\":\"AGD001\",\"isArchived\":true}",,USR001,50
2025-10-23T10:40:00.200Z,INFO,MOVING_FILE_TO_ARCHIVED,AssetGroupDocsController,"INFO: Moving file to archived location","{\"docId\":\"AGD001\"}",,USR001,100
2025-10-23T10:40:00.500Z,INFO,ARCHIVE_STATUS_UPDATED,AssetGroupDocsController,"INFO: Archive status updated successfully","{\"docId\":\"AGD001\",\"isArchived\":true}",,USR001,500
```

## 🚀 **Performance Considerations**

### **Non-Blocking Logging**
All logging calls use `.catch(err => console.error('Logging error:', err))` to prevent blocking the main application flow:

```javascript
assetGroupLogger.logCreateAssetGroupApiCalled({
    text, assetIds, orgId, requestData, userId, duration
}).catch(err => console.error('Logging error:', err));
```

### **Error Handling**
Logging errors are caught and logged to console without affecting the main application:

```javascript
assetGroupLogger.logAssetGroupCreationError({
    text: req.body.text,
    error: err,
    userId
}).catch(logErr => console.error('Logging error:', logErr));
```

## 📈 **Monitoring and Analysis**

### **Key Metrics to Monitor**
1. **API Response Times**: Track duration for each operation
2. **Error Rates**: Monitor ERROR and CRITICAL level events
3. **File Operations**: Track document upload/download success rates
4. **Database Operations**: Monitor transaction success rates

### **Log Analysis Queries**
```bash
# Count operations by type
grep -c "CREATE_ASSET_GROUP_API_CALLED" logs/events/events_GROUPASSET_*.csv

# Find error events
grep "ERROR" logs/events/events_GROUPASSET_*.csv

# Track document operations
grep "DOCUMENT_UPLOADED\|DOCUMENT_ARCHIVED\|DOCUMENT_DELETED" logs/events/events_GROUPASSET_*.csv
```

## 🔧 **Configuration**

### **Log Level Configuration**
The logging system respects the configured log levels in `tblTechnicalLogConfig`:

```sql
-- Enable all log levels for GROUPASSET
INSERT INTO tblTechnicalLogConfig (app_id, log_level, is_enabled) 
VALUES ('GROUPASSET', 'INFO', true);

-- Or configure specific levels
INSERT INTO tblTechnicalLogConfig (app_id, log_level, is_enabled) 
VALUES ('GROUPASSET', 'WARNING', true);
```

### **CSV File Structure**
The CSV files are created in `logs/events/` with the following structure:
- **Filename**: `events_GROUPASSET_YYYY-MM-DD.csv`
- **Headers**: timestamp,level,event_type,module,message,request_data,response_data,user_id,duration

## ✅ **Testing**

### **Test Scenarios**
1. **Create Asset Group**: Verify all validation and creation steps are logged
2. **Upload Document**: Check file upload and database insertion logging
3. **Archive Document**: Verify MinIO operations and database updates
4. **Error Handling**: Test with invalid data to ensure error logging
5. **Performance**: Verify non-blocking logging doesn't impact response times

### **Verification Commands**
```bash
# Check if CSV file is created
ls -la logs/events/events_GROUPASSET_*.csv

# Verify log entries
tail -f logs/events/events_GROUPASSET_$(date +%Y-%m-%d).csv

# Count log entries by level
grep -c "INFO\|WARNING\|ERROR\|CRITICAL" logs/events/events_GROUPASSET_*.csv
```

## 📝 **Summary**

The Asset Group event logging implementation provides comprehensive monitoring for:

✅ **Asset Group CRUD Operations** (Create, Read, Update, Delete)  
✅ **Document Management** (Upload, Download, Archive, Delete)  
✅ **File Operations** (MinIO storage operations)  
✅ **Database Operations** (Transaction logging)  
✅ **Error Handling** (Comprehensive error logging)  
✅ **Performance Monitoring** (Duration tracking)  
✅ **Non-Blocking Logging** (Asynchronous logging)  

This implementation ensures complete visibility into all asset group operations while maintaining optimal performance through non-blocking logging patterns.
