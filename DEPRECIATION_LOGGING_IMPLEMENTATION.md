# Depreciation Event Logging Implementation

## Overview
Comprehensive event logging implementation for the Depreciation module, which is part of the asset management system. Uses the `ASSETS` app_id for context-aware logging.

## Implementation Details

### 1. Event Logger Created
**File**: `AssetLifecycleBackend/eventLoggers/depreciationEventLogger.js`

**Features**:
- 60+ comprehensive logging functions
- Hierarchical log levels: INFO, WARNING, ERROR, CRITICAL
- Detailed step-by-step logging for all operations
- Non-blocking logging with error handling
- Context-aware logging using `ASSETS` app_id

**Key Logging Functions**:
- **Single Asset Depreciation**: API calls, validation, calculation, database operations, success/errors
- **Bulk Depreciation**: API calls, processing, completion, error handling
- **Depreciation History**: API calls, querying, retrieval, errors
- **Depreciation Summary**: API calls, querying, retrieval, errors
- **Assets by Method**: API calls, validation, querying, retrieval, errors
- **Settings Management**: API calls, querying, updating, success/errors
- **Schedule Generation**: API calls, asset fetching, validation, generation, success/errors
- **Database Operations**: Transaction management, rollbacks, connection failures

### 2. Backend Controller Enhanced

#### Depreciation Controller (`depreciationController.js`)
**Enhanced Functions**:
- `calculateAssetDepreciation()` - Single asset depreciation with detailed logging
- `calculateBulkDepreciation()` - Bulk depreciation processing with comprehensive logging
- `getAssetDepreciationHistory()` - Depreciation history retrieval with logging
- `getDepreciationSummary()` - Depreciation summary with logging
- `getAssetsByDepreciationMethod()` - Assets by depreciation method with validation logging
- `getDepreciationSettings()` - Settings retrieval with logging
- `updateDepreciationSettings()` - Settings update with logging
- `generateDepreciationSchedule()` - Schedule generation with detailed logging

**Logging Features**:
- Start time tracking for performance monitoring
- User ID extraction from request
- Non-blocking logging with error handling
- Detailed step-by-step operation logging
- Error logging with context preservation
- Parameter validation logging
- Database operation tracking

### 3. Log File Structure

**CSV File**: `logs/events/events_ASSETS_YYYY-MM-DD.csv`

**Log Levels**:
- **INFO**: Normal operations, API calls, data retrieval, successful operations
- **WARNING**: Missing parameters, validation issues, not found scenarios
- **ERROR**: API errors, validation failures, processing errors
- **CRITICAL**: Database connection failures, system errors

**Sample Log Entries**:
```csv
2025-10-23T12:00:00.000Z,INFO,CALCULATE_ASSET_DEPRECIATION_API_CALLED,DepreciationController,"INFO: Calculate asset depreciation API called","{\"assetId\":\"ASS001\",\"operation\":\"calculate_asset_depreciation\"}",,USR001,150
2025-10-23T12:00:01.000Z,INFO,FETCHING_ASSET_DEPRECIATION_INFO,DepreciationController,"INFO: Fetching asset depreciation information","{\"assetId\":\"ASS001\",\"operation\":\"fetch_asset_depreciation_info\"}",,USR001,50
2025-10-23T12:00:02.000Z,INFO,DEPRECIATION_CALCULATED,DepreciationController,"INFO: Depreciation calculated successfully","{\"assetId\":\"ASS001\",\"depreciationAmount\":1000}",,USR001,25
```

### 4. API Endpoints Logged

All depreciation APIs now have detailed logging:
- ✅ `POST /api/depreciation/calculate/:asset_id` - Calculate single asset depreciation
- ✅ `POST /api/depreciation/bulk` - Calculate bulk depreciation
- ✅ `GET /api/depreciation/history/:asset_id` - Get depreciation history
- ✅ `GET /api/depreciation/summary/:org_id` - Get depreciation summary
- ✅ `GET /api/depreciation/assets/:org_id/:method` - Get assets by depreciation method
- ✅ `GET /api/depreciation/settings/:org_id` - Get depreciation settings
- ✅ `PUT /api/depreciation/settings/:setting_id` - Update depreciation settings
- ✅ `POST /api/depreciation/schedule/:asset_id` - Generate depreciation schedule

### 5. Detailed Logging Examples

#### Single Asset Depreciation Flow:
```javascript
// 1. API Call
logCalculateAssetDepreciationApiCalled() // INFO: Calculate asset depreciation API called

// 2. Asset Validation
logFetchingAssetDepreciationInfo() // INFO: Fetching asset depreciation information
logAssetNotFound() // WARNING: Asset not found for depreciation calculation
logAssetNotEligibleForDepreciation() // WARNING: Asset not eligible for depreciation
logInvalidAssetCost() // WARNING: Invalid asset cost for depreciation

// 3. Parameter Validation
logValidatingDepreciationParams() // INFO: Validating depreciation parameters
logDepreciationParamsInvalid() // WARNING: Invalid depreciation parameters

// 4. Calculation
logCalculatingDepreciation() // INFO: Calculating depreciation
logDepreciationMethodNotSupported() // ERROR: Depreciation method not supported

// 5. Database Operations
logDepreciationCalculated() // INFO: Depreciation calculated successfully
logInsertingDepreciationRecord() // INFO: Inserting depreciation record
logDepreciationRecordInserted() // INFO: Depreciation record inserted successfully
logUpdatingAssetDepreciation() // INFO: Updating asset depreciation values
logAssetDepreciationUpdated() // INFO: Asset depreciation values updated successfully
```

#### Bulk Depreciation Flow:
```javascript
// 1. API Call
logCalculateBulkDepreciationApiCalled() // INFO: Calculate bulk depreciation API called

// 2. Validation
logMissingOrgId() // WARNING: Organization ID required

// 3. Asset Retrieval
logFetchingAssetsForDepreciation() // INFO: Fetching assets for depreciation
logAssetsRetrievedForDepreciation() // INFO: Retrieved 10 assets for depreciation

// 4. Processing
logProcessingBulkDepreciation() // INFO: Processing bulk depreciation calculation

// 5. Completion
logBulkDepreciationCompleted() // INFO: Bulk depreciation calculation completed
```

#### Depreciation History Flow:
```javascript
// 1. API Call
logGetAssetDepreciationHistoryApiCalled() // INFO: Get asset depreciation history API called

// 2. Querying
logQueryingDepreciationHistory() // INFO: Querying depreciation history

// 3. Results
logDepreciationHistoryRetrieved() // INFO: Retrieved 5 depreciation history records
```

#### Depreciation Summary Flow:
```javascript
// 1. API Call
logGetDepreciationSummaryApiCalled() // INFO: Get depreciation summary API called

// 2. Querying
logQueryingDepreciationSummary() // INFO: Querying depreciation summary

// 3. Results
logDepreciationSummaryRetrieved() // INFO: Depreciation summary retrieved successfully
```

#### Assets by Depreciation Method Flow:
```javascript
// 1. API Call
logGetAssetsByDepreciationMethodApiCalled() // INFO: Get assets by depreciation method API called

// 2. Validation
logInvalidDepreciationMethod() // WARNING: Invalid depreciation method

// 3. Querying
logQueryingAssetsByDepreciationMethod() // INFO: Querying assets by depreciation method

// 4. Results
logAssetsByDepreciationMethodRetrieved() // INFO: Retrieved 15 assets for depreciation method SL
```

#### Settings Management Flow:
```javascript
// 1. Get Settings
logGetDepreciationSettingsApiCalled() // INFO: Get depreciation settings API called
logQueryingDepreciationSettings() // INFO: Querying depreciation settings
logDepreciationSettingsRetrieved() // INFO: Depreciation settings retrieved successfully

// 2. Update Settings
logUpdateDepreciationSettingsApiCalled() // INFO: Update depreciation settings API called
logUpdatingDepreciationSettings() // INFO: Updating depreciation settings
logDepreciationSettingsUpdated() // INFO: Depreciation settings updated successfully
```

#### Schedule Generation Flow:
```javascript
// 1. API Call
logGenerateDepreciationScheduleApiCalled() // INFO: Generate depreciation schedule API called

// 2. Asset Validation
logFetchingAssetForSchedule() // INFO: Fetching asset information for schedule generation
logAssetNotFound() // WARNING: Asset not found for depreciation calculation
logAssetNotEligibleForSchedule() // WARNING: Asset not eligible for depreciation schedule

// 3. Generation
logGeneratingDepreciationSchedule() // INFO: Generating depreciation schedule
logDepreciationScheduleGenerated() // INFO: Depreciation schedule generated successfully
```

### 6. Error Scenarios Logged

#### Validation Errors:
```javascript
logAssetNotFound() // WARNING: Asset not found for depreciation calculation
logAssetNotEligibleForDepreciation() // WARNING: Asset not eligible for depreciation
logInvalidAssetCost() // WARNING: Invalid asset cost for depreciation
logDepreciationParamsInvalid() // WARNING: Invalid depreciation parameters
logDepreciationMethodNotSupported() // ERROR: Depreciation method not supported
logMissingOrgId() // WARNING: Organization ID required
logInvalidDepreciationMethod() // WARNING: Invalid depreciation method
```

#### Processing Errors:
```javascript
logAssetDepreciationCalculationError() // ERROR: Asset depreciation calculation failed
logBulkDepreciationError() // ERROR: Bulk depreciation calculation failed
logDepreciationHistoryError() // ERROR: Failed to get depreciation history
logDepreciationSummaryError() // ERROR: Failed to get depreciation summary
logAssetsByDepreciationMethodError() // ERROR: Failed to get assets by depreciation method
logDepreciationSettingsError() // ERROR: Failed to get depreciation settings
logDepreciationSettingsUpdateError() // ERROR: Failed to update depreciation settings
logDepreciationScheduleError() // ERROR: Failed to generate depreciation schedule
```

#### System Errors:
```javascript
logDatabaseConnectionFailure() // CRITICAL: Database connection failure
logDatabaseConstraintViolation() // ERROR: Database constraint violation
logDataRetrievalError() // ERROR: Data retrieval error
```

### 7. Database Operations Logged

#### Transaction Management:
```javascript
logDatabaseTransactionStarted() // INFO: Database transaction started
logDatabaseTransactionCompleted() // INFO: Database transaction completed
logDatabaseTransactionRollback() // ERROR: Database transaction rolled back
```

### 8. Performance Optimizations

**Non-Blocking Logging**:
```javascript
// All logging calls are non-blocking
depreciationLogger.logFunction({...}).catch(err => console.error('Logging error:', err));
```

**Error Handling**:
- Logging errors don't affect main application flow
- Comprehensive error logging for debugging
- Graceful degradation when logging fails

### 9. Integration Points

**Dependencies**:
- `eventLogger.js` - Core logging service
- `technicalLogConfigModel.js` - Log configuration management
- `depreciationModel.js` - Depreciation business logic
- `depreciationService.js` - Depreciation calculation services

**Configuration**:
- Log levels configured in `tblTechnicalLogConfig`
- App ID: `ASSETS`
- Log directory: `logs/events/`
- CSV format with headers

### 10. Testing and Verification

**Test Scenarios**:
1. **Single Asset Depreciation**: Calculate depreciation for individual assets
2. **Bulk Depreciation**: Process multiple assets for depreciation
3. **Depreciation History**: Retrieve historical depreciation records
4. **Depreciation Summary**: Get organization-wide depreciation summary
5. **Assets by Method**: Filter assets by depreciation method
6. **Settings Management**: Get and update depreciation settings
7. **Schedule Generation**: Generate depreciation schedules
8. **Error Scenarios**: Test validation errors and system errors

**Verification Steps**:
1. Check CSV file creation: `logs/events/events_ASSETS_YYYY-MM-DD.csv`
2. Verify log entries for each operation
3. Confirm detailed step-by-step logging works
4. Test error scenarios and error logging

### 11. Benefits

**Operational Benefits**:
- Complete audit trail for all depreciation operations
- Performance monitoring with duration tracking
- Error tracking and debugging capabilities
- User activity monitoring
- Depreciation calculation visibility

**Technical Benefits**:
- Non-blocking logging for performance
- Context-aware routing to assets CSV
- Comprehensive error handling
- Detailed step-by-step operation tracking
- Easy debugging and troubleshooting

### 12. Asset Management Integration

Since depreciation is part of the asset management system:
- Uses `ASSETS` app_id for consistent logging
- Logs are written to the same CSV file as other asset operations
- Provides complete visibility into the depreciation process
- Enables tracking of depreciation calculations and outcomes

## Conclusion

The Depreciation event logging implementation provides comprehensive logging for all operations within the depreciation module. The implementation includes detailed step-by-step logging, hierarchical log levels, non-blocking performance, and complete coverage of all user interactions and system operations.

All depreciation operations are now fully logged with detailed information for monitoring, debugging, and audit purposes, providing complete visibility into the asset depreciation process.
