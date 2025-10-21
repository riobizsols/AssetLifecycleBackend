# 🎯 Reports Event Logging Implementation Guide

## ✅ What's Complete

### 1. **Event Logger Created**
**File:** `eventLoggers/reportsEventLogger.js` (500+ lines)

Comprehensive logging functions for ALL report screens with:
- ✅ Generic helpers (`logReportApiCall`, `logReportGenerationSuccess`, `logReportError`)
- ✅ **INFO** level: Data retrieval, filters applied, export initiated (7 functions)
- ✅ **WARNING** level: Missing params, no data found, invalid filters, unauthorized access, large result sets (5 functions)
- ✅ **ERROR** level: Generation errors, database query errors, parsing errors, export errors (4 functions)
- ✅ **CRITICAL** level: DB connection failure, constraint violations, resource exhaustion, data corruption (4 functions)

### 2. **Database Configurations Added**
All 6 report screens configured in `tblTechnicalLogConfig`:

| App ID | Log Level | File Name |
|--------|-----------|-----------|
| ✅ ASSETLIFECYCLEREPORT | WARNING | `events_ASSETLIFECYCLEREPORT_2025-10-19.csv` |
| ✅ ASSETREPORT | WARNING | `events_ASSETREPORT_2025-10-19.csv` |
| ✅ MAINTENANCEHISTORY | WARNING | `events_MAINTENANCEHISTORY_2025-10-19.csv` |
| ✅ ASSETVALUATION | WARNING | `events_ASSETVALUATION_2025-10-19.csv` |
| ✅ ASSETWORKFLOWHISTORY | WARNING | `events_ASSETWORKFLOWHISTORY_2025-10-19.csv` |
| ✅ BREAKDOWNHISTORY | WARNING | `events_BREAKDOWNHISTORY_2025-10-19.csv` |

---

## 📋 Controllers to Update

| # | Screen | Controller File | Main Functions | Status |
|---|--------|----------------|----------------|--------|
| 1 | Asset Lifecycle Report | `assetLifecycleController.js` | `getAssetLifecycle` | ⏳ Pending |
| 2 | Asset Report | `assetController.js` or dedicated | `getAllAssets`, `searchAssets` | ⏳ Pending |
| 3 | Maintenance History | `maintenanceHistoryController.js` | `getMaintenanceHistory` | ⏳ Pending |
| 4 | Asset Valuation | `assetValuationController.js` | `getAssetValuationData` | ⏳ Pending |
| 5 | Asset Workflow History | `assetWorkflowHistoryController.js` | `getAssetWorkflowHistory` | ⏳ Pending |
| 6 | Breakdown History | `breakdownHistoryController.js` | `getBreakdownHistory`, `getBreakdownHistoryByAsset` | ⏳ Pending |

---

## 🔧 Implementation Pattern

### Example: Asset Lifecycle Report Controller

```javascript
const {
    logReportApiCall,
    logReportGenerationSuccess,
    logReportError,
    logReportDataRetrieval,
    logReportDataRetrieved,
    logReportFiltersApplied,
    logMissingParameters,
    logNoDataFound,
    logUnauthorizedReportAccess,
    logLargeResultSet,
    logReportGenerationError,
    logDatabaseQueryError,
    logDatabaseConnectionFailure
} = require('../eventLoggers/reportsEventLogger');

const getAssetLifecycle = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const APP_ID = 'ASSETLIFECYCLEREPORT';
    
    try {
        const { filters, limit, offset } = req.query;
        
        // Step 1: Log API called
        await logReportApiCall({
            appId: APP_ID,
            operation: 'Get Asset Lifecycle Report',
            method: req.method,
            url: req.originalUrl,
            requestData: { filters, limit, offset },
            userId
        });
        
        // Step 2: Validate organization ID
        const orgId = req.user?.org_id;
        if (!orgId) {
            await logUnauthorizedReportAccess({
                appId: APP_ID,
                reportType: 'Asset Lifecycle',
                userId,
                duration: Date.now() - startTime
            });
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Step 3: Log filters applied
        if (filters && Object.keys(filters).length > 0) {
            await logReportFiltersApplied({
                appId: APP_ID,
                reportType: 'Asset Lifecycle',
                filters,
                userId
            });
        }
        
        // Step 4: Log data retrieval started
        await logReportDataRetrieval({
            appId: APP_ID,
            reportType: 'Asset Lifecycle',
            filters,
            userId
        });
        
        // Step 5: Fetch data
        const [data, count] = await Promise.all([
            assetLifecycleModel.getAssetLifecycleData(filters),
            assetLifecycleModel.getAssetLifecycleCount(filters)
        ]);
        
        // Step 6: Check if data found
        if (data.length === 0) {
            await logNoDataFound({
                appId: APP_ID,
                reportType: 'Asset Lifecycle',
                filters,
                userId,
                duration: Date.now() - startTime
            });
        } else {
            // Step 7: Log success
            await logReportDataRetrieved({
                appId: APP_ID,
                reportType: 'Asset Lifecycle',
                recordCount: data.length,
                filters,
                duration: Date.now() - startTime,
                userId
            });
            
            // Step 8: Warn if large result set
            if (data.length > 1000) {
                await logLargeResultSet({
                    appId: APP_ID,
                    reportType: 'Asset Lifecycle',
                    recordCount: data.length,
                    threshold: 1000,
                    userId
                });
            }
        }
        
        res.status(200).json({ success: true, data, count });
        
    } catch (err) {
        console.error('Error in getAssetLifecycle:', err);
        
        // Determine error level
        const isDbError = err.code && (err.code.startsWith('23') || err.code.startsWith('42') || err.code === 'ECONNREFUSED');
        
        if (err.code === 'ECONNREFUSED') {
            // CRITICAL: Database connection failure
            await logDatabaseConnectionFailure({
                appId: APP_ID,
                reportType: 'Asset Lifecycle',
                error: err,
                userId,
                duration: Date.now() - startTime
            });
        } else if (isDbError) {
            // ERROR: Database query error
            await logDatabaseQueryError({
                appId: APP_ID,
                reportType: 'Asset Lifecycle',
                query: 'getAssetLifecycleData',
                error: err,
                userId,
                duration: Date.now() - startTime
            });
        } else {
            // ERROR: General report error
            await logReportGenerationError({
                appId: APP_ID,
                reportType: 'Asset Lifecycle',
                error: err,
                filters: req.query,
                userId,
                duration: Date.now() - startTime
            });
        }
        
        res.status(500).json({ error: 'Failed to generate report' });
    }
};
```

---

## 📝 Implementation Checklist for Each Controller

For each of the 6 controllers, add logging with these steps:

### **Required Imports**
```javascript
const {
    logReportApiCall,
    logReportGenerationSuccess,
    logReportDataRetrieval,
    logReportDataRetrieved,
    logReportFiltersApplied,
    logMissingParameters,
    logNoDataFound,
    logUnauthorizedReportAccess,
    logLargeResultSet,
    logReportGenerationError,
    logDatabaseQueryError,
    logDatabaseConnectionFailure
} = require('../eventLoggers/reportsEventLogger');
```

### **Function Pattern**
```javascript
const getReportData = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const APP_ID = 'YOUR_REPORT_APP_ID'; // Change per controller
    
    try {
        // 1. Log API called
        await logReportApiCall({...});
        
        // 2. Validate & log unauthorized if needed
        if (!orgId) {
            await logUnauthorizedReportAccess({...});
            return res.status(401).json({...});
        }
        
        // 3. Log filters applied
        if (filters) {
            await logReportFiltersApplied({...});
        }
        
        // 4. Log data retrieval started
        await logReportDataRetrieval({...});
        
        // 5. Fetch data (your existing code)
        const data = await model.getData(...);
        
        // 6. Log no data or success
        if (data.length === 0) {
            await logNoDataFound({...});
        } else {
            await logReportDataRetrieved({...});
            
            // 7. Warn if large result
            if (data.length > 1000) {
                await logLargeResultSet({...});
            }
        }
        
        res.status(200).json(data);
        
    } catch (err) {
        // 8. Log appropriate error level
        if (err.code === 'ECONNREFUSED') {
            await logDatabaseConnectionFailure({...});
        } else if (isDbError) {
            await logDatabaseQueryError({...});
        } else {
            await logReportGenerationError({...});
        }
        
        res.status(500).json({ error: 'Failed' });
    }
};
```

---

## 🎯 App IDs for Each Controller

| Controller | APP_ID | Report Type Name |
|------------|--------|------------------|
| `assetLifecycleController.js` | `'ASSETLIFECYCLEREPORT'` | `'Asset Lifecycle'` |
| `assetController.js` (reports) | `'ASSETREPORT'` | `'Asset Report'` |
| `maintenanceHistoryController.js` | `'MAINTENANCEHISTORY'` | `'Maintenance History'` |
| `assetValuationController.js` | `'ASSETVALUATION'` | `'Asset Valuation'` |
| `assetWorkflowHistoryController.js` | `'ASSETWORKFLOWHISTORY'` | `'Asset Workflow History'` |
| `breakdownHistoryController.js` | `'BREAKDOWNHISTORY'` | `'Breakdown History'` |

---

## 🧪 Expected Log Output

### Example: ASSETLIFECYCLEREPORT

```csv
Timestamp,Level,EventType,Module,Message,RequestData,ResponseData,Duration,UserId
2025-10-19T10:00:00.000Z,INFO,API_CALL,ReportController,"GET /api/asset-lifecycle - Get Asset Lifecycle Report","{filters:{status:'Active'},limit:100}","{status:'processing'}",null,USR001
2025-10-19T10:00:00.100Z,INFO,FILTERS_APPLIED,ReportController,"Filters applied to Asset Lifecycle report","{filter_keys:['status'],filters:{status:'Active'}}","{filters_valid:true}",null,USR001
2025-10-19T10:00:00.200Z,INFO,DATA_RETRIEVAL,ReportController,"Retrieving Asset Lifecycle report data","{report_type:'Asset Lifecycle'}","{status:'fetching'}",null,USR001
2025-10-19T10:00:01.500Z,INFO,DATA_RETRIEVED,ReportController,"Retrieved 250 records for Asset Lifecycle report","{report_type:'Asset Lifecycle'}","{success:true,record_count:250}",1300,USR001
```

### Example: No Data Found (WARNING)

```csv
2025-10-19T10:05:00.000Z,WARNING,NO_DATA,ReportController,"No data found for Asset Lifecycle report","{report_type:'Asset Lifecycle',filters:{status:'Archived'}}","{record_count:0,has_data:false}",500,USR001
```

### Example: Database Error (ERROR)

```csv
2025-10-19T10:10:00.000Z,ERROR,DATABASE_ERROR,ReportController,"Database query failed for Asset Lifecycle report","{report_type:'Asset Lifecycle'}","{error:'relation does not exist',error_code:'42P01'}",150,USR001
```

---

## 📊 Summary

### ✅ Completed
- [x] Created comprehensive `reportsEventLogger.js` with 20+ functions
- [x] Added 6 report configurations to database
- [x] Set default log level to WARNING for all reports
- [x] Created implementation guide and patterns

### ⏳ Next Steps
1. **Update Asset Lifecycle Controller** (`assetLifecycleController.js`)
2. **Update Maintenance History Controller** (`maintenanceHistoryController.js`)
3. **Update Asset Valuation Controller** (`assetValuationController.js`)
4. **Update Asset Workflow History Controller** (`assetWorkflowHistoryController.js`)
5. **Update Breakdown History Controller** (`breakdownHistoryController.js`)
6. **Update Asset Report Controller** (identify correct file)

### 🚀 Quick Start
Copy the implementation pattern above and apply to each controller, changing:
- `APP_ID` constant
- `reportType` string
- Function names to match controller

---

## 🎉 Benefits

Once complete, you'll have:
✅ **6 separate log files** - one per report screen  
✅ **Detailed error logs** - full stack traces and error details  
✅ **Performance monitoring** - duration tracking for each report  
✅ **Large result warnings** - automatic alerts for datasets > 1000 records  
✅ **Filter tracking** - see exactly what filters were applied  
✅ **Unauthorized access tracking** - security monitoring  
✅ **Database error isolation** - identify query vs. connection issues  

All report operations will be fully traceable! 🎯

