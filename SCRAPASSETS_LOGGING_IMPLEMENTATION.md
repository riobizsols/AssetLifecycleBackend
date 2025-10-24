# Scrap Assets Event Logging Implementation

## Overview
Comprehensive event logging implementation for the Scrap Assets module (`SCRAPASSETS` app_id) covering all operations including viewing, creating, updating, deleting, and managing scrap assets.

## Implementation Details

### 1. Event Logger Created
**File**: `AssetLifecycleBackend/eventLoggers/scrapAssetsEventLogger.js`

**Features**:
- 50+ comprehensive logging functions
- Hierarchical log levels: INFO, WARNING, ERROR, CRITICAL
- Detailed step-by-step logging for all operations
- Non-blocking logging with error handling
- Context-aware logging for different operations

**Key Logging Functions**:
- **General Operations**: API calls, validation, processing, success, errors
- **Scrap Assets List**: Retrieval, empty results, errors
- **Scrap Asset by ID**: Individual asset retrieval, not found, errors
- **Available Assets by Type**: Asset type filtering, validation, retrieval
- **Add Scrap Asset**: Creation flow, validation, database insertion
- **Update Scrap Asset**: Update flow, validation, database updates
- **Delete Scrap Asset**: Deletion flow, validation, database removal
- **Nearing Expiry**: Assets expiring soon, retrieval, processing
- **Expired Assets**: Expired assets retrieval, processing
- **Category Assets**: Category-based asset retrieval, processing
- **Database Errors**: Connection failures, constraint violations, data retrieval errors

### 2. Backend Controllers Enhanced

#### A. Asset Scrap Controller (`assetScrapController.js`)
**Enhanced Functions**:
- `getAllScrapAssets()` - List all scrap assets with detailed logging
- `getScrapAssetById()` - Get individual scrap asset with validation logging
- `getAvailableAssetsByAssetType()` - Get available assets by type with filtering logging
- `addScrapAsset()` - Create scrap asset with comprehensive creation flow logging
- `updateScrapAsset()` - Update scrap asset with validation and update logging
- `deleteScrapAsset()` - Delete scrap asset with deletion flow logging

**Logging Features**:
- Start time tracking for performance monitoring
- User ID extraction from request
- Non-blocking logging with error handling
- Detailed step-by-step operation logging
- Error logging with context preservation

#### B. Scrap Assets by Type Controller (`scrapAssetsByTypeController.js`)
**Enhanced Functions**:
- `getScrapAssetsByAssetType()` - Get scrap assets by category with logging
- `getAssetTypesWithScrapAssets()` - Get asset types with scrap assets

**Logging Features**:
- Category-based logging for asset type operations
- Data retrieval error handling
- Comprehensive operation tracking

#### C. Asset Controller (Context-Aware)
**Enhanced Functions**:
- `getAssetsExpiringWithin30Days()` - Context-aware logging for scrap assets
- `getAssetsByExpiryDate()` - Expired assets logging for scrap assets context

**Context-Aware Features**:
- Checks for `context=SCRAPASSETS` query parameter
- Routes logs to scrap assets CSV when context matches
- Maintains existing ASSETS logging for other contexts

### 3. Frontend Components Enhanced

#### A. Main Scrap Assets Page (`ScrapAssets.jsx`)
**Enhanced API Calls**:
- `/assets/count` - Total assets count with context
- `/assets/expiry/expiring_soon?days=30` - Nearing expiry with context
- `/assets/expiry/expired` - Expired assets with context
- `/assets/expiring-30-days-by-type` - Category-based expiry with context

#### B. Nearing Expiry Component (`NearingExpiry.jsx`)
**Enhanced API Calls**:
- `/assets/expiry/expiring_soon?days=30` - Nearing expiry assets with context
- `/scrap-assets` - Create scrap asset with context

#### C. Expired Assets Component (`ExpiredAssets.jsx`)
**Enhanced API Calls**:
- `/assets/expiry/expired` - Expired assets with context
- `/scrap-assets` - Create scrap asset with context

#### D. Category Assets Component (`CategoryAssets.jsx`)
**Enhanced API Calls**:
- `/assets/expiring-30-days-by-type` - Category assets with context
- `/assets/expiry/expiring_soon?days=30&asset_type=${id}` - Fallback with context
- `/scrap-assets` - Create scrap asset with context

#### E. Create Scrap Asset Component (`CreateScrapAsset.jsx`)
**Enhanced API Calls**:
- `/scrap-assets/available-by-type/${assetTypeId}` - Available assets with context
- `/asset-types` - Asset types with context
- `/assets/${assetId}` - Asset details with context
- `/scrap-assets` - Create scrap asset with context

### 4. Context-Aware Logging Implementation

**Frontend Context Passing**:
```javascript
// All API calls include context parameter
const response = await API.get('/endpoint', {
  params: { context: 'SCRAPASSETS' }
});
```

**Backend Context Detection**:
```javascript
// Controllers check for context parameter
const { context } = req.query;
if (context === 'SCRAPASSETS') {
  // Use scrap assets logger
  scrapAssetsLogger.logFunction({...});
}
```

### 5. Log File Structure

**CSV File**: `logs/events/events_SCRAPASSETS_YYYY-MM-DD.csv`

**Log Levels**:
- **INFO**: Normal operations, API calls, data retrieval, successful operations
- **WARNING**: Missing data, validation issues, not found scenarios
- **ERROR**: API errors, validation failures, processing errors
- **CRITICAL**: Database connection failures, system errors

**Sample Log Entries**:
```csv
2025-10-22T12:00:00.000Z,INFO,SCRAP_ASSETS_LIST_API_CALLED,AssetScrapController,"INFO: Get all scrap assets API called","{\"operation\":\"get_all_scrap_assets\"}","{\"count\":5}",USR001,150
2025-10-22T12:00:01.000Z,INFO,QUERYING_SCRAP_ASSETS,AssetScrapController,"INFO: Querying scrap assets from database","{\"operation\":\"fetch_all_scrap_assets\"}",,USR001,50
2025-10-22T12:00:02.000Z,INFO,SCRAP_ASSETS_RETRIEVED,AssetScrapController,"INFO: Retrieved 5 scrap assets","{\"count\":5}",,USR001,25
```

### 6. Routes Covered

**Scrap Assets Routes**:
- `http://localhost:5173/scrap-assets` - Main dashboard
- `http://localhost:5173/scrap-assets/nearing-expiry` - Nearing expiry assets
- `http://localhost:5173/scrap-assets/expired` - Expired assets
- `http://localhost:5173/scrap-assets/by-category/Fire%20Extinguisher` - Category assets
- `http://localhost:5173/scrap-assets/create` - Create scrap asset

**API Endpoints Logged**:
- `GET /api/scrap-assets` - List all scrap assets
- `GET /api/scrap-assets/:id` - Get scrap asset by ID
- `GET /api/scrap-assets/available-by-type/:asset_type_id` - Available assets by type
- `POST /api/scrap-assets` - Create scrap asset
- `PUT /api/scrap-assets/:id` - Update scrap asset
- `DELETE /api/scrap-assets/:id` - Delete scrap asset
- `GET /api/assets/expiry/expired` - Expired assets (context-aware)
- `GET /api/assets/expiry/expiring_soon` - Nearing expiry assets (context-aware)
- `GET /api/assets/expiring-30-days-by-type` - Category assets (context-aware)

### 7. Performance Optimizations

**Non-Blocking Logging**:
```javascript
// All logging calls are non-blocking
scrapAssetsLogger.logFunction({...}).catch(err => console.error('Logging error:', err));
```

**Error Handling**:
- Logging errors don't affect main application flow
- Comprehensive error logging for debugging
- Graceful degradation when logging fails

### 8. Testing and Verification

**Test Scenarios**:
1. **View Scrap Assets**: Navigate to scrap assets pages and verify logging
2. **Create Scrap Asset**: Create new scrap asset and verify creation logging
3. **Update Scrap Asset**: Update existing scrap asset and verify update logging
4. **Delete Scrap Asset**: Delete scrap asset and verify deletion logging
5. **Category Operations**: View assets by category and verify category logging
6. **Expiry Operations**: View nearing expiry and expired assets with logging

**Verification Steps**:
1. Check CSV file creation: `logs/events/events_SCRAPASSETS_YYYY-MM-DD.csv`
2. Verify log entries for each operation
3. Confirm context-aware logging works correctly
4. Test error scenarios and error logging

### 9. Integration Points

**Dependencies**:
- `eventLogger.js` - Core logging service
- `technicalLogConfigModel.js` - Log configuration management
- `useNavigation.js` - Frontend navigation permissions
- `useAuditLog.js` - Frontend audit logging

**Configuration**:
- Log levels configured in `tblTechnicalLogConfig`
- App ID: `SCRAPASSETS`
- Log directory: `logs/events/`
- CSV format with headers

### 10. Benefits

**Operational Benefits**:
- Complete audit trail for all scrap assets operations
- Performance monitoring with duration tracking
- Error tracking and debugging capabilities
- User activity monitoring
- Data flow visibility

**Technical Benefits**:
- Non-blocking logging for performance
- Context-aware routing to correct CSV files
- Comprehensive error handling
- Detailed step-by-step operation tracking
- Easy debugging and troubleshooting

## Conclusion

The Scrap Assets event logging implementation provides comprehensive logging for all operations within the scrap assets module. The implementation includes detailed step-by-step logging, context-aware routing, non-blocking performance, and complete coverage of all user interactions and system operations.

All scrap assets operations are now fully logged with detailed information for monitoring, debugging, and audit purposes.
