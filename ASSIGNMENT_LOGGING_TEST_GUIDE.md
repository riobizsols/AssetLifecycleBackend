# Assignment Event Logging - Testing Guide

## 🧪 How to Test DEPTASSIGNMENT and EMPASSIGNMENT Event Logging

This guide will help you verify that event logging is working correctly for both department and employee asset assignment flows.

---

## 📋 Prerequisites

1. **Backend running**: `npm start` or `pm2 start ecosystem.config.js`
2. **Frontend running**: Navigate to the application
3. **Database configured**: Ensure database connection is working
4. **User logged in**: You need to be authenticated
5. **Test data available**:
   - At least one department
   - At least one employee
   - At least one inactive asset available for assignment

---

## 🗂️ Log File Locations

After running tests, check these files in the `logs/events/` directory:

```
logs/events/
├── events_DEPTASSIGNMENT_2025-10-22.csv
├── events_EMPASSIGNMENT_2025-10-22.csv
└── ... other log files
```

---

## 🧪 Test Scenarios

### Test 1: Department Assignment Flow

#### Steps:
1. **Navigate** to Department-wise Asset Assignment page
2. **Select** a department from dropdown
3. **Click** "Assign Asset" button
4. You're redirected to Asset Selection page
5. **Select** an asset type (optional)
6. **Click** "Assign Asset" button next to an asset
7. **Verify** assignment was successful

#### Expected Logs in `events_DEPTASSIGNMENT_YYYY-MM-DD.csv`:

```csv
# 1. Assignment initiated
Timestamp,AppId,EventType,Module,Message,LogLevel,...
...,DEPTASSIGNMENT,ASSIGNMENT_INITIATED,AssetAssignmentController,INFO: Asset assignment to department initiated - Asset: A001, Dept: DEPT01,INFO,...

# 2. Assignment successful
...,DEPTASSIGNMENT,ASSIGNMENT_SUCCESS,AssetAssignmentController,INFO: Asset assigned to department successfully - Asset: A001, Dept: DEPT01,INFO,...
```

#### What to Check:
- ✅ `appId` should be `DEPTASSIGNMENT`
- ✅ `message` contains asset ID and department ID
- ✅ `logLevel` is `INFO`
- ✅ `requestData` contains `asset_id`, `dept_id`, `org_id`
- ✅ `responseData` shows `success: true`
- ✅ `duration` is recorded (in milliseconds)
- ✅ `userId` is present

---

### Test 2: Employee Assignment Flow

#### Steps:
1. **Navigate** to Employee-wise Asset Assignment page
2. **Select** a department from department filter
3. **Select** an employee from employee dropdown
4. **Click** "Assign Asset" button
5. You're redirected to Asset Selection page
6. **Select** an asset type (optional)
7. **Click** "Assign Asset" button next to an asset
8. **Verify** assignment was successful

#### Expected Logs in `events_EMPASSIGNMENT_YYYY-MM-DD.csv`:

```csv
# 1. Department filter changed
...,EMPASSIGNMENT,FILTER_APPLIED,EmployeeWiseAssetAssignment,INFO: Department filter changed - Dept: DEPT01,INFO,...

# 2. Employee selected
...,EMPASSIGNMENT,EMPLOYEE_SELECTED,EmployeeWiseAssetAssignment,INFO: Employee selected - Employee: EMP123 (Int ID: EMP001),INFO,...

# 3. Assignment initiated
...,EMPASSIGNMENT,ASSIGNMENT_INITIATED,AssetAssignmentController,INFO: Asset assignment to employee initiated - Asset: A002, Employee: EMP001,INFO,...

# 4. Assignment successful
...,EMPASSIGNMENT,ASSIGNMENT_SUCCESS,AssetAssignmentController,INFO: Asset assigned to employee successfully - Asset: A002, Employee: EMP001,INFO,...
```

#### What to Check:
- ✅ `appId` should be `EMPASSIGNMENT`
- ✅ `message` contains asset ID and employee ID
- ✅ `logLevel` is `INFO`
- ✅ `requestData` contains `asset_id`, `employee_int_id`, `dept_id`, `org_id`
- ✅ `responseData` shows `success: true`
- ✅ `duration` is recorded
- ✅ `userId` is present

---

### Test 3: Department Unassignment

#### Steps:
1. **Navigate** to Department-wise Asset Assignment page
2. **Select** a department that has assigned assets
3. **Click** "Unassign" button on an assigned asset
4. **Confirm** unassignment in the modal

#### Expected Logs in `events_DEPTASSIGNMENT_YYYY-MM-DD.csv`:

```csv
# 1. Assignments retrieved
...,DEPTASSIGNMENT,ASSIGNMENTS_VIEW,AssetAssignmentController,INFO: Retrieved 5 assignments for department DEPT01,INFO,...

# 2. Unassignment initiated
...,DEPTASSIGNMENT,UNASSIGNMENT_INITIATED,AssetAssignmentController,INFO: Asset unassignment from department initiated - Asset: A001, Dept: DEPT01,INFO,...

# 3. Unassignment successful
...,DEPTASSIGNMENT,UNASSIGNMENT_SUCCESS,AssetAssignmentController,INFO: Asset unassigned from department successfully - Asset: A001, Dept: DEPT01,INFO,...
```

---

### Test 4: Employee Unassignment

#### Steps:
1. **Navigate** to Employee-wise Asset Assignment page
2. **Select** department and employee with assigned assets
3. **Click** "Unassign" button on an assigned asset
4. **Confirm** unassignment in the modal

#### Expected Logs in `events_EMPASSIGNMENT_YYYY-MM-DD.csv`:

```csv
# 1. Assignments retrieved
...,EMPASSIGNMENT,ASSIGNMENTS_VIEW,AssetAssignmentController,INFO: Retrieved 3 assignments for employee EMP123,INFO,...

# 2. Unassignment initiated
...,EMPASSIGNMENT,UNASSIGNMENT_INITIATED,AssetAssignmentController,INFO: Asset unassignment from employee initiated - Asset: A002, Employee: EMP001,INFO,...

# 3. Unassignment successful
...,EMPASSIGNMENT,UNASSIGNMENT_SUCCESS,AssetAssignmentController,INFO: Asset unassigned from employee successfully - Asset: A002, Employee: EMP001,INFO,...
```

---

### Test 5: Assignment History View

#### Steps:
1. **Navigate** to Department or Employee Assignment page
2. **Select** a department or employee
3. **Click** "History" button

#### Expected Logs:

**For Department:**
```csv
...,DEPTASSIGNMENT,HISTORY_VIEW,AssetAssignmentHistory,INFO: Assignment history viewed for department DEPT01,INFO,...
```

**For Employee:**
```csv
...,EMPASSIGNMENT,HISTORY_VIEW,AssetAssignmentHistory,INFO: Assignment history viewed for employee EMP001,INFO,...
```

---

### Test 6: Validation Errors (WARNING Level)

#### Test 6a: Invalid Department
1. Manually call API: `GET /api/asset-assignments/department/INVALID_DEPT/assignments`

**Expected Log:**
```csv
...,DEPTASSIGNMENT,VALIDATION_ERROR,AssetAssignmentController,WARNING: Invalid department ID - INVALID_DEPT,WARNING,...
```

#### Test 6b: Duplicate Assignment
1. Try to assign the same asset to the same department again

**Expected Log:**
```csv
...,DEPTASSIGNMENT,DUPLICATE_ASSIGNMENT,AssetAssignmentController,WARNING: Asset already assigned to department - Asset: A001, Dept: DEPT01,WARNING,...
```

#### Test 6c: Missing Parameters
1. Manually call API with missing required fields

**Expected Log:**
```csv
...,DEPTASSIGNMENT,VALIDATION_ERROR,AssetAssignmentController,WARNING: addAssetAssignment - Missing required parameters,WARNING,...
```

---

### Test 7: Error Scenarios (ERROR Level)

#### Test 7a: Database Query Error
1. Temporarily stop database or cause a query error

**Expected Log:**
```csv
...,DEPTASSIGNMENT,DATABASE_ERROR,AssetAssignmentController,ERROR: Database query failed - ...,ERROR,...
```

---

### Test 8: Asset Type Filtering

#### Steps:
1. **Navigate** to Asset Selection page (from either flow)
2. **Select** an asset type from dropdown
3. **Observe** filtered asset list

#### Expected Logs:

**For Department Flow:**
```csv
...,DEPTASSIGNMENT,FILTER_APPLIED,AssetSelection,INFO: Asset type filter applied - Type: 5,INFO,...
```

**For Employee Flow:**
```csv
...,EMPASSIGNMENT,FILTER_APPLIED,AssetSelection,INFO: Asset type filter applied - Type: 5,INFO,...
```

---

## 🔍 How to Verify Logs

### Method 1: Using CSV Viewer/Excel
1. Navigate to `AssetLifecycleBackend/logs/events/`
2. Open `events_DEPTASSIGNMENT_2025-10-22.csv` (use today's date)
3. Open `events_EMPASSIGNMENT_2025-10-22.csv` (use today's date)
4. Verify entries match your test actions

### Method 2: Using Terminal (Windows PowerShell)
```powershell
# View latest department assignment logs
Get-Content -Path "logs/events/events_DEPTASSIGNMENT_$(Get-Date -Format 'yyyy-MM-dd').csv" -Tail 20

# View latest employee assignment logs
Get-Content -Path "logs/events/events_EMPASSIGNMENT_$(Get-Date -Format 'yyyy-MM-dd').csv" -Tail 20

# Search for specific asset
Select-String -Path "logs/events/events_DEPTASSIGNMENT_*.csv" -Pattern "A001"

# Count events by level
(Get-Content "logs/events/events_EMPASSIGNMENT_$(Get-Date -Format 'yyyy-MM-dd').csv" | Select-String -Pattern ",INFO,").Count
```

### Method 3: Using Node.js Script
Create a test script to read and parse logs:

```javascript
// testAssignmentLogs.js
const fs = require('fs');
const path = require('path');

const today = new Date().toISOString().split('T')[0];
const deptLogFile = path.join(__dirname, 'logs', 'events', `events_DEPTASSIGNMENT_${today}.csv`);
const empLogFile = path.join(__dirname, 'logs', 'events', `events_EMPASSIGNMENT_${today}.csv`);

console.log('📋 Department Assignment Logs:');
if (fs.existsSync(deptLogFile)) {
    const content = fs.readFileSync(deptLogFile, 'utf-8');
    const lines = content.split('\n');
    console.log(`Total entries: ${lines.length - 1}`); // -1 for header
    console.log('\nLast 5 entries:');
    console.log(lines.slice(-5).join('\n'));
} else {
    console.log('❌ No log file found for today');
}

console.log('\n📋 Employee Assignment Logs:');
if (fs.existsSync(empLogFile)) {
    const content = fs.readFileSync(empLogFile, 'utf-8');
    const lines = content.split('\n');
    console.log(`Total entries: ${lines.length - 1}`);
    console.log('\nLast 5 entries:');
    console.log(lines.slice(-5).join('\n'));
} else {
    console.log('❌ No log file found for today');
}
```

Run with: `node testAssignmentLogs.js`

---

## ✅ Success Criteria

For the implementation to be considered successful, verify:

### Department Assignment (DEPTASSIGNMENT)
- ✅ CSV file created: `events_DEPTASSIGNMENT_YYYY-MM-DD.csv`
- ✅ Assignment logs to correct file
- ✅ Unassignment logs to correct file
- ✅ All INFO events logged
- ✅ All WARNING events logged (when tested)
- ✅ All ERROR events logged (when tested)
- ✅ RequestData and ResponseData are properly formatted JSON
- ✅ Duration is calculated and logged
- ✅ UserId is captured

### Employee Assignment (EMPASSIGNMENT)
- ✅ CSV file created: `events_EMPASSIGNMENT_YYYY-MM-DD.csv`
- ✅ Assignment logs to correct file
- ✅ Unassignment logs to correct file
- ✅ Department filter changes logged
- ✅ Employee selection logged
- ✅ All INFO events logged
- ✅ All WARNING events logged (when tested)
- ✅ All ERROR events logged (when tested)
- ✅ RequestData and ResponseData are properly formatted JSON
- ✅ Duration is calculated and logged
- ✅ UserId is captured

### Common Screen (Asset Selection)
- ✅ Logs to DEPTASSIGNMENT when accessed from department flow
- ✅ Logs to EMPASSIGNMENT when accessed from employee flow
- ✅ Asset type filtering logged to correct file
- ✅ Asset viewing logged to correct file

---

## 🐛 Common Issues and Solutions

### Issue 1: CSV file not created
**Solution**: 
- Check if `logs/events/` directory exists
- Check file permissions
- Verify backend is running
- Check console for errors

### Issue 2: Logs appear in wrong CSV file
**Solution**:
- Verify `entityType` is correctly passed from frontend
- Check that correct event logger is being used in controller
- Verify appId in event logger files

### Issue 3: Missing data in logs
**Solution**:
- Check that all required parameters are being passed to logging functions
- Verify request body contains necessary data
- Check for null/undefined values

### Issue 4: Duration is always null
**Solution**:
- Verify `startTime` is captured at the beginning of function
- Ensure `Date.now() - startTime` is calculated before logging
- Check that duration parameter is being passed

---

## 📊 Expected Log Patterns

### Normal Flow (All INFO)
```
ASSIGNMENT_INITIATED → ASSIGNMENT_SUCCESS → ASSIGNMENTS_VIEW
```

### Assignment with Filtering
```
FILTER_APPLIED → ASSETS_VIEW → ASSIGNMENT_INITIATED → ASSIGNMENT_SUCCESS
```

### Failed Assignment
```
ASSIGNMENT_INITIATED → VALIDATION_ERROR (WARNING) → Assignment fails
```

### Unassignment Flow
```
ASSIGNMENTS_VIEW → UNASSIGNMENT_INITIATED → UNASSIGNMENT_SUCCESS
```

---

## 🎯 Quick Test Checklist

Run through this quick checklist to verify basic functionality:

- [ ] **DEPT-1**: Assign asset to department → Check DEPTASSIGNMENT CSV
- [ ] **DEPT-2**: Unassign asset from department → Check DEPTASSIGNMENT CSV
- [ ] **DEPT-3**: View department assignments → Check DEPTASSIGNMENT CSV
- [ ] **DEPT-4**: View assignment history → Check DEPTASSIGNMENT CSV
- [ ] **EMP-1**: Assign asset to employee → Check EMPASSIGNMENT CSV
- [ ] **EMP-2**: Unassign asset from employee → Check EMPASSIGNMENT CSV
- [ ] **EMP-3**: View employee assignments → Check EMPASSIGNMENT CSV
- [ ] **EMP-4**: Change department filter → Check EMPASSIGNMENT CSV
- [ ] **EMP-5**: View assignment history → Check EMPASSIGNMENT CSV
- [ ] **COMMON-1**: Asset selection from dept flow → Logs to DEPTASSIGNMENT
- [ ] **COMMON-2**: Asset selection from emp flow → Logs to EMPASSIGNMENT

---

## 📝 Test Report Template

After testing, document your findings:

```
Date: [TODAY]
Tester: [YOUR NAME]

✅ PASSED TESTS:
- Department assignment
- Employee assignment
- Unassignment flows
- History viewing
- Filtering

❌ FAILED TESTS:
- [List any failures]

🐛 ISSUES FOUND:
- [List any issues]

📊 LOG FILE STATUS:
- events_DEPTASSIGNMENT_*.csv: [Created/Not Created] - [X entries]
- events_EMPASSIGNMENT_*.csv: [Created/Not Created] - [X entries]

💡 NOTES:
- [Any additional observations]
```

---

## 🚀 Next Steps After Testing

If all tests pass:
1. ✅ Mark implementation as complete
2. ✅ Update documentation
3. ✅ Commit changes
4. ✅ Deploy to staging/production

If tests fail:
1. 🔍 Review error logs
2. 🐛 Fix identified issues
3. 🧪 Re-run tests
4. 📝 Update documentation

---

**Happy Testing! 🎉**

For issues or questions, refer to:
- `ASSIGNMENT_EVENT_LOGGING_SUMMARY.md` - Implementation details
- `eventLoggers/README.md` - Event logger architecture
- `HOW_TO_TEST_EVENT_LOGGING.md` - General testing guide

