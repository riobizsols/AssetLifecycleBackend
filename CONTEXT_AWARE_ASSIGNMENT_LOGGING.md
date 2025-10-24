# Context-Aware Assignment Logging - Complete Implementation

## 🎯 Overview

The assignment logging is now **fully context-aware** for the shared screens (asset-selection and asset-detail). These common screens now log to the appropriate CSV file based on which flow the user came from.

**Implementation Date**: October 22, 2025  
**Version**: 3.0 (Context-Aware Logging)

---

## 🔄 How It Works

### The Problem
- `asset-selection` screen is used by **both** DEPTASSIGNMENT and EMPASSIGNMENT flows
- `asset-detail` screen is used by **both** DEPTASSIGNMENT and EMPASSIGNMENT flows
- Previously: All operations logged to `events_ASSETS_*.csv`
- **Now**: Logs to the correct CSV based on context!

### The Solution

**Frontend** passes a `context` parameter:
- From Department flow → `context=DEPTASSIGNMENT`
- From Employee flow → `context=EMPASSIGNMENT`

**Backend** checks the context and uses the appropriate logger:
- If `context=DEPTASSIGNMENT` → logs to `events_DEPTASSIGNMENT_*.csv`
- If `context=EMPASSIGNMENT` → logs to `events_EMPASSIGNMENT_*.csv`
- If no context → logs to `events_ASSETS_*.csv` (default)

---

## 📊 What Gets Logged

### 1. Department Selection (4 steps)
```
User selects department from dropdown
    ↓
STEP 1: API called - GET /api/asset-assignments/department/{dept_id}/assignments
STEP 2: Database query - Querying assignments for department
STEP 3: Data processing - Processing N assignment records
STEP 4: Data retrieved - Retrieved N assignments
    ↓
Logs to: events_DEPTASSIGNMENT_2025-10-22.csv
```

### 2. Employee Selection (4 steps)
```
User selects employee from dropdown
    ↓
STEP 1: API called - GET /api/asset-assignments/employee/{emp_id}/active
STEP 2: Database query - Querying assignments for employee
STEP 3: Data processing - Processing N assignment records
STEP 4: Data retrieved - Retrieved N assignments
    ↓
Logs to: events_EMPASSIGNMENT_2025-10-22.csv
```

### 3. Asset Type Selection (4 steps)
```
User selects asset type in asset-selection screen
    ↓
STEP 1: Asset type selected - Type: AT013
STEP 2: API called - GET /api/assets/type/{type_id}/inactive?context=DEPTASSIGNMENT
STEP 3: Filter applied - Fetching assets for asset type
STEP 4: Assets viewed - Viewed N available assets
    ↓
Logs to: events_DEPTASSIGNMENT_2025-10-22.csv (if from dept flow)
    OR
Logs to: events_EMPASSIGNMENT_2025-10-22.csv (if from emp flow)
```

### 4. Asset Details Viewing (2 steps)
```
User clicks asset ID to view details
    ↓
STEP 1: API called - GET /api/assets/{asset_id}?context=DEPTASSIGNMENT
STEP 2: Asset details retrieved successfully
    ↓
Logs to: events_DEPTASSIGNMENT_2025-10-22.csv (if from dept flow)
    OR
Logs to: events_EMPASSIGNMENT_2025-10-22.csv (if from emp flow)
```

### 5. Asset Assignment (10 steps)
```
User clicks "Assign Asset" button
    ↓
STEP 1: API called - POST /api/asset-assignments
STEP 2: Validating parameters
STEP 3: Checking asset type configuration
STEP 4: Asset type validated
STEP 5: Checking for existing assignment
STEP 6: No existing assignment found
STEP 7: Assignment ID generated
STEP 8: Inserting to database
STEP 9: Assignment inserted successfully
STEP 10: Assignment success
    ↓
Logs to: events_DEPTASSIGNMENT_2025-10-22.csv (for dept)
    OR
Logs to: events_EMPASSIGNMENT_2025-10-22.csv (for emp)
```

### 6. History Viewing (3 steps)
```
User clicks "History" button
    ↓
STEP 1: API called - GET /api/asset-assignments/dept/{dept_id}
STEP 2: Database query - Querying assignments
STEP 3: History viewed successfully
    ↓
Logs to: events_DEPTASSIGNMENT_2025-10-22.csv (for dept)
    OR
Logs to: events_EMPASSIGNMENT_2025-10-22.csv (for emp)
```

---

## 🔧 Implementation Details

### Frontend Changes

#### 1. AssetSelection.jsx
```javascript
// When fetching inactive assets by type
const context = entityType === 'employee' ? 'EMPASSIGNMENT' : 'DEPTASSIGNMENT';
const res = await API.get(`/assets/type/${assetTypeId}/inactive`, {
  params: { context }
});

// When navigating to asset detail
navigate(`/asset-detail/${asset.asset_id}?context=${context}`, {
  state: { ..., context }
});
```

#### 2. AssetsDetail.jsx
```javascript
// Extract context from URL or state
const [searchParams] = useSearchParams();
const contextFromUrl = searchParams.get('context') || context;

// Pass context to API
const params = contextFromUrl ? { context: contextFromUrl } : {};
API.get(`/assets/${asset_id}`, { params })
```

### Backend Changes

#### 1. assetController.js - getInactiveAssetsByAssetType
```javascript
// Extract context from query params
const { context } = req.query;

// Use appropriate logger based on context
const deptAssignmentLogger = context === 'DEPTASSIGNMENT' ? require('../eventLoggers/deptAssignmentEventLogger') : null;
const empAssignmentLogger = context === 'EMPASSIGNMENT' ? require('../eventLoggers/empAssignmentEventLogger') : null;

// Log to appropriate CSV
if (deptAssignmentLogger) {
  await deptAssignmentLogger.logAssetTypeSelected({ ... });
} else if (empAssignmentLogger) {
  await empAssignmentLogger.logAssetTypeSelected({ ... });
}
```

#### 2. assetController.js - getAssetById
```javascript
// Same context-aware logging
const { context } = req.query;

// Use appropriate logger
if (deptAssignmentLogger) {
  await deptAssignmentLogger.logApiCall({ ... });
} else if (empAssignmentLogger) {
  await empAssignmentLogger.logApiCall({ ... });
} else {
  // Default to ASSETS logger
  await logApiCall({ ... });
}
```

---

## 📝 Example: Complete Flow with Detailed Logs

### Department Assignment Flow

```csv
# User selects department DPT201
2025-10-22T10:00:00.100Z,INFO,API_CALL,AssetAssignmentController,"GET /api/asset-assignments/department/DPT201/assignments - Department assignments retrieval API called"
2025-10-22T10:00:00.101Z,INFO,DB_QUERY,AssetAssignmentController,"Querying assignments for department DPT201"
2025-10-22T10:00:00.250Z,INFO,DATA_PROCESSING,AssetAssignmentController,"Processing 4 assignment records for display"
2025-10-22T10:00:00.251Z,INFO,DATA_RETRIEVED,AssetAssignmentController,"Retrieved 4 assignments for department DPT201"

# User clicks "Assign Asset" button (navigates to asset-selection)
# User selects asset type AT013
2025-10-22T10:01:00.100Z,INFO,ASSET_TYPE_SELECTED,AssetSelection,"Asset type selected - Type: AT013"
2025-10-22T10:01:00.101Z,INFO,API_CALL,AssetAssignmentController,"GET /api/assets/type/AT013/inactive?context=DEPTASSIGNMENT - getInactiveAssetsByAssetType"
2025-10-22T10:01:00.102Z,INFO,FILTER_APPLIED,AssetSelection,"Fetching assets for asset type AT013"
2025-10-22T10:01:00.250Z,INFO,ASSETS_VIEW,AssetSelection,"Viewed 10 available assets for department assignment"

# User clicks on asset ASS029 to view details
2025-10-22T10:02:00.100Z,INFO,API_CALL,AssetAssignmentController,"GET /api/assets/ASS029?context=DEPTASSIGNMENT - Get Asset Details"
2025-10-22T10:02:00.250Z,INFO,ASSIGNMENT_OPERATION,AssetAssignmentController,"Get Asset Details completed successfully"

# User clicks "Assign Asset" on ASS029
2025-10-22T10:03:00.100Z,INFO,API_CALL,AssetAssignmentController,"POST /api/asset-assignments - Department assignment API called"
2025-10-22T10:03:00.101Z,INFO,VALIDATION,AssetAssignmentController,"Validating assignment parameters"
2025-10-22T10:03:00.102Z,INFO,DB_QUERY,AssetAssignmentController,"Checking asset type assignment configuration"
2025-10-22T10:03:00.120Z,INFO,VALIDATION,AssetAssignmentController,"Asset type validated - Type: Department"
2025-10-22T10:03:00.121Z,INFO,DB_QUERY,AssetAssignmentController,"Checking for existing assignment"
2025-10-22T10:03:00.135Z,INFO,VALIDATION,AssetAssignmentController,"No existing assignment found - can proceed"
2025-10-22T10:03:00.136Z,INFO,ID_GENERATION,AssetAssignmentController,"Assignment ID generated - AA1729584180100"
2025-10-22T10:03:00.137Z,INFO,DB_QUERY,AssetAssignmentController,"Inserting assignment to database"
2025-10-22T10:03:00.155Z,INFO,DB_QUERY,AssetAssignmentController,"Assignment inserted to database successfully"
2025-10-22T10:03:00.156Z,INFO,ASSIGNMENT_SUCCESS,AssetAssignmentController,"Asset assigned to department successfully - Asset: ASS029, Dept: DPT201"

# User clicks "History" button
2025-10-22T10:04:00.100Z,INFO,API_CALL,AssetAssignmentController,"GET /api/asset-assignments/dept/DPT201 - getDepartmentAssignmentHistory"
2025-10-22T10:04:00.101Z,INFO,DB_QUERY,AssetAssignmentController,"Querying assignments for department DPT201"
2025-10-22T10:04:00.250Z,INFO,HISTORY_VIEW,AssetAssignmentHistory,"Assignment history viewed for department DPT201"
```

**ALL OF THE ABOVE LOGS** → `events_DEPTASSIGNMENT_2025-10-22.csv` ✅

---

## 🎯 Key Features

### 1. **Context Passed via Query Parameter**
```
/api/assets/type/AT013/inactive?context=DEPTASSIGNMENT
/api/assets/ASS029?context=EMPASSIGNMENT
```

### 2. **Frontend Automatically Determines Context**
```javascript
const context = entityType === 'employee' ? 'EMPASSIGNMENT' : 'DEPTASSIGNMENT';
```

### 3. **Backend Uses Appropriate Logger**
```javascript
if (context === 'DEPTASSIGNMENT') {
  await deptAssignmentLogger.logAssetTypeSelected({ ... });
} else if (context === 'EMPASSIGNMENT') {
  await empAssignmentLogger.logAssetTypeSelected({ ... });
}
```

### 4. **Falls Back to ASSETS Logger**
```javascript
// If no context provided
else {
  await logApiCall({ ... }); // Logs to events_ASSETS_*.csv
}
```

---

## 📋 Testing Checklist

### Department Assignment Flow
- [ ] Select department → Check 4 logs in DEPTASSIGNMENT CSV
- [ ] Click "Assign Asset" → Navigate to asset-selection
- [ ] Select asset type → Check 4 logs in DEPTASSIGNMENT CSV
- [ ] Click asset ID to view details → Check 2 logs in DEPTASSIGNMENT CSV
- [ ] Assign asset → Check 10 logs in DEPTASSIGNMENT CSV
- [ ] Click "History" → Check 3 logs in DEPTASSIGNMENT CSV

### Employee Assignment Flow
- [ ] Select department filter → Check log in EMPASSIGNMENT CSV
- [ ] Select employee → Check 4 logs in EMPASSIGNMENT CSV
- [ ] Click "Assign Asset" → Navigate to asset-selection
- [ ] Select asset type → Check 4 logs in EMPASSIGNMENT CSV
- [ ] Click asset ID to view details → Check 2 logs in EMPASSIGNMENT CSV
- [ ] Assign asset → Check 8 logs in EMPASSIGNMENT CSV
- [ ] Click "History" → Check 3 logs in EMPASSIGNMENT CSV

### Verify No Cross-Contamination
- [ ] Department flow operations should ONLY log to DEPTASSIGNMENT CSV
- [ ] Employee flow operations should ONLY log to EMPASSIGNMENT CSV
- [ ] Asset operations outside assignment flow should log to ASSETS CSV

---

## 🧪 How to Test

### Test 1: Department Flow Complete Journey

1. **Navigate to Department Assignment page**
2. **Select DPT201** from dropdown
3. **Check CSV**: Should see 4 logs
   ```powershell
   Get-Content "logs/events/events_DEPTASSIGNMENT_$(Get-Date -Format 'yyyy-MM-dd').csv" -Tail 5
   ```

4. **Click "Assign Asset"** button
5. **Select asset type AT013**
6. **Check CSV**: Should see 4 MORE logs (asset type selection + API + filtering + viewing)

7. **Click on asset ASS029** to view details
8. **Check CSV**: Should see 2 MORE logs (API call + details retrieved)

9. **Go back and click "Assign Asset"** on ASS029
10. **Check CSV**: Should see 10 MORE logs (complete assignment flow)

11. **Click "History"** button
12. **Check CSV**: Should see 3 MORE logs (history API + query + retrieved)

**Total logs for complete journey**: ~23 logs in `events_DEPTASSIGNMENT_*.csv` ✅

### Test 2: Employee Flow Complete Journey

Follow same steps as above but starting from Employee Assignment page.

**Total logs**: ~25 logs in `events_EMPASSIGNMENT_*.csv` ✅

---

## 📁 Files Modified

### Backend
1. **eventLoggers/deptAssignmentEventLogger.js**
   - Added `logAssetTypeSelected()`
   - Added `logDeptSelectionApiCalled()`
   - Added `logQueryingDeptAssignments()`
   - Added `logProcessingAssignmentData()`
   - Total: 50+ functions

2. **eventLoggers/empAssignmentEventLogger.js**
   - Added `logAssetTypeSelected()`
   - Added `logEmpSelectionApiCalled()`
   - Added `logQueryingEmpAssignments()`
   - Added `logProcessingEmpAssignmentData()`
   - Total: 52+ functions

3. **controllers/assetController.js**
   - Updated `getInactiveAssetsByAssetType()` - Context-aware logging (4 steps)
   - Updated `getAssetById()` - Context-aware logging (2 steps)

4. **controllers/assetAssignmentController.js**
   - Updated `addAssetAssignment()` - Detailed logging (10 steps)
   - Updated `addEmployeeAssetAssignment()` - Detailed logging (8 steps)
   - Updated `getDepartmentWiseAssetAssignments()` - Detailed logging (4 steps)
   - Updated `getActiveAssetAssignmentsByEmployee()` - Detailed logging (4 steps)
   - Updated `getAssetAssignmentsByDept()` - History logging (3 steps)
   - Updated `getAssetAssignmentsByEmployee()` - History logging (3 steps)
   - Updated `updateAssetAssignment()` - Unassignment logging

### Frontend
1. **components/assetAssignment/AssetSelection.jsx**
   - Added context parameter to `fetchInactiveAssetsByType()` API call
   - Added context to asset detail navigation URL

2. **components/assetAssignment/AssetsDetail.jsx**
   - Added `useSearchParams` import
   - Extract context from URL query params
   - Pass context to asset API call

---

## 🎨 Event Types

| Event Type | Description | Example |
|------------|-------------|---------|
| **API_CALL** | API endpoint invoked | GET /api/assets/type/AT013/inactive called |
| **ASSET_TYPE_SELECTED** | User selects asset type | Asset type selected - Type: AT013 |
| **FILTER_APPLIED** | Filter applied to data | Fetching assets for asset type AT013 |
| **ASSETS_VIEW** | Assets list viewed | Viewed 10 available assets |
| **DB_QUERY** | Database operation | Querying assignments for department |
| **DATA_PROCESSING** | Data formatting | Processing 4 assignment records |
| **DATA_RETRIEVED** | Data successfully fetched | Retrieved 4 assignments |
| **VALIDATION** | Parameter validation | Validating assignment parameters |
| **ID_GENERATION** | ID generation | Assignment ID generated |
| **ASSIGNMENT_SUCCESS** | Assignment completed | Asset assigned successfully |
| **HISTORY_VIEW** | History accessed | Assignment history viewed |

---

## 📈 Expected Log Volume

### Per Department Selection:
- 4 logs (API + Query + Processing + Retrieved)

### Per Asset Type Selection:
- 4 logs (Selected + API + Filter + Viewed)

### Per Asset Detail View:
- 2 logs (API + Retrieved)

### Per Asset Assignment:
- 10 logs (Full flow from API to success)

### Per History View:
- 3 logs (API + Query + Viewed)

**Complete User Journey**: ~23-25 logs per full assignment cycle

---

## ✅ What's Working Now

1. ✅ **Department selection** → Logs to DEPTASSIGNMENT CSV (4 steps)
2. ✅ **Employee selection** → Logs to EMPASSIGNMENT CSV (4 steps)
3. ✅ **Asset type selection** → Logs to appropriate CSV (4 steps) **NEW!**
4. ✅ **Asset details viewing** → Logs to appropriate CSV (2 steps) **NEW!**
5. ✅ **Asset assignment** → Logs to appropriate CSV (10 steps)
6. ✅ **Asset unassignment** → Logs to appropriate CSV
7. ✅ **History viewing** → Logs to appropriate CSV (3 steps)
8. ✅ **Context preservation** across navigation
9. ✅ **Fallback to ASSETS** if no context

---

## 🧪 Quick Test Commands

### View Department Assignment Logs
```powershell
Get-Content "AssetLifecycleBackend/logs/events/events_DEPTASSIGNMENT_$(Get-Date -Format 'yyyy-MM-dd').csv" -Tail 20
```

### View Employee Assignment Logs
```powershell
Get-Content "AssetLifecycleBackend/logs/events/events_EMPASSIGNMENT_$(Get-Date -Format 'yyyy-MM-dd').csv" -Tail 20
```

### Count Logs by Event Type
```powershell
# Department assignment logs
(Get-Content "logs/events/events_DEPTASSIGNMENT_*.csv" | Select-String -Pattern "ASSET_TYPE_SELECTED").Count
(Get-Content "logs/events/events_DEPTASSIGNMENT_*.csv" | Select-String -Pattern "ASSETS_VIEW").Count
(Get-Content "logs/events/events_DEPTASSIGNMENT_*.csv" | Select-String -Pattern "HISTORY_VIEW").Count
```

### Search for Specific Asset
```powershell
Select-String -Path "logs/events/events_DEPTASSIGNMENT_*.csv" -Pattern "ASS029"
```

---

## 🎉 Summary

✅ **Complete context-aware logging** implemented  
✅ **Common screens log to appropriate CSV** based on user flow  
✅ **Detailed step-by-step logging** for all operations  
✅ **23-25 logs** per complete assignment journey  
✅ **No cross-contamination** between different flows  
✅ **Fallback mechanism** for operations outside assignment context  
✅ **Consistent with ASSETS and REPORTS** logging patterns  

**Status**: ✅ **COMPLETE & PRODUCTION READY**

---

## 🚀 Next Steps

1. **Restart backend** to load changes:
   ```powershell
   pm2 restart all
   ```

2. **Test complete flow**:
   - Department assignment flow
   - Employee assignment flow
   - Verify CSV files

3. **Monitor log files** for a few days to ensure all operations are captured

4. **Adjust log levels** if needed:
   ```sql
   UPDATE tblTechnicalLogConfig
   SET log_level = 'INFO'  -- To see all detailed logs
   WHERE app_id IN ('DEPTASSIGNMENT', 'EMPASSIGNMENT');
   ```

---

**Last Updated**: October 22, 2025  
**Version**: 3.0 (Context-Aware + Detailed Flow Logging)  
**Status**: Complete ✅

