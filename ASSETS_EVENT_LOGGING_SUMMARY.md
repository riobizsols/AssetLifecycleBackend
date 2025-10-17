# ASSETS Event Logging Implementation Summary

## Overview

Event logging has been implemented for the ASSETS module with **all 4 log levels**: INFO, WARNING, ERROR, and CRITICAL.

---

## Implemented Log Levels for ASSETS

### ✅ **INFO** - Successful Operations

| Operation | Event Type | Message | When Logged |
|-----------|------------|---------|-------------|
| **Create Asset** | ASSET_CREATE | Asset created successfully - {name} | Asset successfully created |
| **View All Assets** | ASSET_VIEW | Retrieved all assets successfully | Assets list retrieved |

### ⚠️ **WARNING** - Validation Failures

| Operation | Event Type | Message | When Logged |
|-----------|------------|---------|-------------|
| **Create Asset** | ASSET_CREATE | Unauthorized asset creation attempt | User not authenticated |
| **Create Asset** | ASSET_CREATE | Asset creation failed - missing required fields | Required fields (text, org_id) missing |
| **Create Asset** | ASSET_CREATE | Asset creation failed - invalid purchase vendor | Purchase vendor ID doesn't exist |
| **Create Asset** | ASSET_CREATE | Asset creation failed - invalid service vendor | Service vendor ID doesn't exist |
| **Create Asset** | ASSET_CREATE | Asset creation failed - duplicate asset ID | Asset ID already exists in system |

### ❌ **ERROR** - Operation Failures

| Operation | Event Type | Message | When Logged |
|-----------|------------|---------|-------------|
| **Create Asset** | ASSET_CREATE | Asset creation failed - {error message} | General operation failure (non-DB) |
| **View All Assets** | ASSET_VIEW | Failed to retrieve assets - {error message} | Database query fails |

### 🚨 **CRITICAL** - System Failures

| Operation | Event Type | Message | When Logged |
|-----------|------------|---------|-------------|
| **Create Asset** | ASSET_CREATE | Asset creation failed - {error message} | Database constraint violation (code 23xxx, 42xxx) |

---

## Code Locations

### Files Modified:
- `controllers/assetController.js`
  - **Line 3:** Added eventLogger import
  - **Lines 5-237:** `addAsset()` function with all log levels
  - **Lines 241-280:** `getAllAssets()` function with INFO and ERROR logging

---

## Log Level Decision Logic

### INFO (Level 0)
```javascript
// Successful operations
await eventLogger.logEvent({
    appId: 'ASSETS',
    logLevel: 'INFO',
    message: 'Asset created successfully'
});
```

### WARNING (Level 1)
```javascript
// Validation failures, missing required fields
if (!text || !org_id) {
    await eventLogger.logEvent({
        appId: 'ASSETS',
        logLevel: 'WARNING',
        message: 'Asset creation failed - missing required fields'
    });
}
```

### ERROR (Level 2)
```javascript
// General operation failures
catch (err) {
    const isDbError = err.code && (err.code.startsWith('23') || err.code.startsWith('42'));
    const logLevel = isDbError ? 'CRITICAL' : 'ERROR';
    await eventLogger.logEvent({
        appId: 'ASSETS',
        logLevel,
        message: `Asset creation failed - ${err.message}`
    });
}
```

### CRITICAL (Level 3)
```javascript
// Database constraint violations, system failures
if (isDbError) {
    await eventLogger.logEvent({
        appId: 'ASSETS',
        logLevel: 'CRITICAL',
        message: 'Asset creation failed - database error'
    });
}
```

---

## Testing Each Log Level

### Test 1: INFO Level (Successful Asset Creation)

**Set log level to INFO:**
```sql
UPDATE "tblTechnicalLogConfig" 
SET log_level = 'INFO' 
WHERE app_id = 'ASSETS';
```

**Test Action:**
```bash
# Create a new asset via API/Frontend
POST /api/assets/add
{
  "text": "Test Laptop",
  "org_id": "ORG001",
  "asset_type_id": "AT001",
  "purchased_cost": 50000
}
```

**Expected Log:**
```csv
2025-10-16T...,INFO,ASSET_CREATE,AssetController,"INFO: Asset created successfully - Test Laptop",...
```

---

### Test 2: WARNING Level (Missing Required Fields)

**Set log level to WARNING:**
```sql
UPDATE "tblTechnicalLogConfig" 
SET log_level = 'WARNING' 
WHERE app_id = 'ASSETS';
```

**Test Action:**
```bash
# Try to create asset without required fields
POST /api/assets/add
{
  "asset_type_id": "AT001"
  // Missing "text" and "org_id"
}
```

**Expected Log:**
```csv
2025-10-16T...,WARNING,ASSET_CREATE,AssetController,"WARNING: Asset creation failed - missing required fields",...
```

---

### Test 3: WARNING Level (Invalid Vendor)

**Test Action:**
```bash
# Try to create asset with invalid vendor
POST /api/assets/add
{
  "text": "Test Asset",
  "org_id": "ORG001",
  "purchase_vendor_id": "INVALID_VENDOR_ID"
}
```

**Expected Log:**
```csv
2025-10-16T...,WARNING,ASSET_CREATE,AssetController,"WARNING: Asset creation failed - invalid purchase vendor",...
```

---

### Test 4: WARNING Level (Duplicate Asset ID)

**Test Action:**
```bash
# Try to create asset with existing asset_id
POST /api/assets/add
{
  "text": "Test Asset",
  "org_id": "ORG001",
  "asset_id": "EXISTING_ASSET_ID"  // Already exists
}
```

**Expected Log:**
```csv
2025-10-16T...,WARNING,ASSET_CREATE,AssetController,"WARNING: Asset creation failed - duplicate asset ID",...
```

---

### Test 5: ERROR Level (Database Query Failure)

**Set log level to ERROR:**
```sql
UPDATE "tblTechnicalLogConfig" 
SET log_level = 'ERROR' 
WHERE app_id = 'ASSETS';
```

**Test Action:**
```bash
# Stop database temporarily or cause a timeout
# Then try to fetch assets
GET /api/assets
```

**Expected Log:**
```csv
2025-10-16T...,ERROR,ASSET_VIEW,AssetController,"ERROR: Failed to retrieve assets - connection timeout",...
```

---

### Test 6: CRITICAL Level (Database Constraint Violation)

**Set log level to CRITICAL:**
```sql
UPDATE "tblTechnicalLogConfig" 
SET log_level = 'CRITICAL' 
WHERE app_id = 'ASSETS';
```

**Test Action:**
```bash
# Force a database constraint violation
# For example, violate a foreign key constraint
POST /api/assets/add
{
  "text": "Test Asset",
  "org_id": "NON_EXISTENT_ORG",  // Violates foreign key
  "asset_type_id": "AT001"
}
```

**Expected Log:**
```csv
2025-10-16T...,CRITICAL,ASSET_CREATE,AssetController,"CRITICAL: Asset creation failed - foreign key constraint violated",...
```

---

## Current Configuration

Check current log level for ASSETS:
```sql
SELECT app_id, log_level, enabled 
FROM "tblTechnicalLogConfig" 
WHERE app_id = 'ASSETS';
```

Expected result:
```
 app_id  | log_level | enabled 
---------|-----------|--------
 ASSETS  | ERROR     | true
```

---

## Event Types Used

| Event Type | Description |
|------------|-------------|
| ASSET_CREATE | Creating new assets |
| ASSET_VIEW | Viewing/retrieving assets |
| ASSET_UPDATE | Updating existing assets (future) |
| ASSET_DELETE | Deleting assets (future) |

---

## Log File Format

Logs are written to: `logs/events/events_YYYY-MM-DD.csv`

**Format:**
```csv
Timestamp,Log Level,Event Type,Module,Message,Request Data,Response Data,Duration (ms),User ID
```

**Example Entries:**

```csv
2025-10-16T10:30:15.123Z,INFO,ASSET_CREATE,AssetController,"INFO: Asset created successfully - Dell Laptop","{""asset_id"":""AST001"",""asset_name"":""Dell Laptop""}","{""success"":true}",245,USR001

2025-10-16T10:31:22.456Z,WARNING,ASSET_CREATE,AssetController,"WARNING: Asset creation failed - missing required fields","{""text"":null,""org_id"":null}","{""error"":""Required fields missing""}",12,USR002

2025-10-16T10:32:45.789Z,ERROR,ASSET_VIEW,AssetController,"ERROR: Failed to retrieve assets - connection timeout","{""operation"":""getAllAssets""}","{""error"":""timeout""}",5000,USR003

2025-10-16T10:33:10.321Z,CRITICAL,ASSET_CREATE,AssetController,"CRITICAL: Asset creation failed - foreign key constraint violation","{""org_id"":""INVALID""}","{""error"":""FK violation"",""code"":""23503""}",100,USR004
```

---

## Quick Test Commands

### Via cURL:

**Test INFO (Success):**
```bash
curl -X POST http://localhost:4000/api/assets/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "Test Laptop",
    "org_id": "ORG001",
    "asset_type_id": "AT001",
    "purchased_cost": 50000
  }'
```

**Test WARNING (Missing Fields):**
```bash
curl -X POST http://localhost:4000/api/assets/add \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "asset_type_id": "AT001"
  }'
```

**Test INFO (View Assets):**
```bash
curl -X GET http://localhost:4000/api/assets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Verification

After running tests, verify logs:

**Windows:**
```powershell
Get-Content logs\events\events_$(Get-Date -Format "yyyy-MM-dd").csv | Select-Object -Last 10
```

**Linux/Mac:**
```bash
tail -10 logs/events/events_$(date +%Y-%m-%d).csv
```

---

## Summary

✅ **Implemented Log Levels:**
- **INFO**: 2 scenarios (create success, view success)
- **WARNING**: 5 scenarios (unauthorized, missing fields, invalid vendors, duplicate ID)
- **ERROR**: 2 scenarios (general failures, query failures)
- **CRITICAL**: 1 scenario (database constraint violations)

✅ **Total Event Types:** 2 (ASSET_CREATE, ASSET_VIEW)

✅ **Functions Covered:**
- `addAsset()` - Full logging (all 4 levels)
- `getAllAssets()` - INFO and ERROR logging

🔄 **Future Enhancements:**
- `updateAsset()` - Add all log levels
- `deleteAsset()` - Add all log levels
- `getAssetById()` - Add INFO and ERROR
- Additional validation scenarios

---

## Configuration Reference

**Log Level Codes:**
- 0 = INFO
- 1 = WARNING
- 2 = ERROR
- 3 = CRITICAL
- 4 = NONE

**Remember:** Exact matching - only logs events that match the configured level!

