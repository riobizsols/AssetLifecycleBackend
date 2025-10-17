# BF01 Breakdown Workflow Implementation

## Overview

This document describes the implementation of workflow-based approval for BF01 (Prepone) breakdowns, where breakdowns require approval through the workflow system before updating existing maintenance schedules.

## Problem Statement

Previously, when a BF01 breakdown was created for an asset that already had a maintenance schedule with status "IN", the system would immediately update the maintenance date to the current date without any approval process.

The requirement is to:
1. Always create a workflow for BF01 breakdowns (even when an existing "IN" schedule exists)
2. After final approval, update the existing maintenance schedule's date to the current date
3. Ensure the workflow approval process is followed for all BF01 breakdowns

## Solution Implementation

### 1. Modified BF01 Breakdown Logic

**File**: `models/reportbreakdownModel.js`

**Changes**: Lines 191-276

The BF01 logic has been updated to:

1. **Always create workflow when asset type requires workflow** - Even if an existing "IN" schedule exists
2. **Store reference to existing schedule** - The existing `ams_id` is encoded in the workflow detail notes
3. **Fallback to direct update** - If no workflow is required, the system falls back to the previous behavior

#### Key Code Changes:

```javascript
if (decision_code === 'BF01') {
  if (hasWorkflow) {
    // Always create workflow, even with existing schedule
    const noteText = existingSchedule 
      ? `BF01-Breakdown-${abr_id}-ExistingSchedule-${existingSchedule.ams_id}`
      : `BF01-Breakdown-${abr_id}`;
    // ... create workflow with this note
  } else if (existingSchedule) {
    // No workflow: update existing schedule directly
  } else {
    // No workflow: create new schedule
  }
}
```

**Note Format**: 
- With existing schedule: `BF01-Breakdown-{ABR_ID}-ExistingSchedule-{AMS_ID}`
- Without existing schedule: `BF01-Breakdown-{ABR_ID}`

### 2. Modified Approval Completion Logic

**File**: `models/approvalDetailModel.js`

**Function**: `createMaintenanceRecord()`

**Changes**: Lines 925-1031

The function now:

1. **Detects BF01 breakdowns** - Checks for `BF01-Breakdown` pattern in workflow detail notes
2. **Extracts existing schedule reference** - Parses the `ams_id` from the notes
3. **Updates instead of creates** - If an existing schedule is found, updates it with current date
4. **Falls back to creation** - If no existing schedule or update fails, creates a new record

#### Key Code Changes:

```javascript
// Query includes BF01 detection
const workflowQuery = `
  SELECT ...
    (
      SELECT d.notes
      FROM "tblWFAssetMaintSch_D" d
      WHERE d.wfamsh_id = wfh.wfamsh_id
        AND d.org_id = $2
        AND d.notes ILIKE '%BF01-Breakdown%'
      LIMIT 1
    ) as bf01_notes,
  ...
`;

// Extract existing ams_id from notes
if (workflowData.bf01_notes && workflowData.bf01_notes.includes('ExistingSchedule')) {
  const match = workflowData.bf01_notes.match(/ExistingSchedule-([^-\s]+)/);
  if (match && match[1]) {
    existingAmsId = match[1];
  }
}

// Update existing schedule
if (existingAmsId) {
  const updateQuery = `
    UPDATE "tblAssetMaintSch"
    SET act_maint_st_date = CURRENT_DATE,
        wfamsh_id = $1,
        maint_type_id = $2,
        vendor_id = $3,
        at_main_freq_id = $4,
        maintained_by = $5,
        changed_by = 'system',
        changed_on = CURRENT_TIMESTAMP
    WHERE ams_id = $6 AND org_id = $7
    RETURNING ams_id
  `;
  // ... execute update
}
```

## Workflow Process Flow

### Scenario: BF01 Breakdown with Existing Maintenance Schedule

```
1. Asset has existing maintenance schedule in tblAssetMaintSch
   - Status: "IN"
   - ams_id: "ams001"
   - act_maint_st_date: 2024-12-01

2. User creates BF01 breakdown
   - breakdown_id: "ABR001"
   - decision_code: "BF01"

3. System creates workflow (if asset type requires workflow)
   - Creates record in tblWFAssetMaintSch_H
     * wfamsh_id: "WFAMSH_01"
     * status: "IP" (In Process)
   - Creates records in tblWFAssetMaintSch_D
     * First approver: status "AP" (Approval Pending)
     * Subsequent approvers: status "IN" (Inactive)
     * notes: "BF01-Breakdown-ABR001-ExistingSchedule-ams001"

4. Approval Process
   - First approver approves → status changes to "UA" (User Approved)
   - Next approver's status changes to "AP"
   - Process continues until all approvers complete

5. Final Approval (all users approved)
   - checkAndUpdateWorkflowStatus() detects completion
   - Updates tblWFAssetMaintSch_H.status to "CO" (Completed)
   - Calls createMaintenanceRecord()

6. createMaintenanceRecord() execution
   - Detects BF01 breakdown from notes
   - Extracts existing ams_id: "ams001"
   - Updates existing record in tblAssetMaintSch:
     * act_maint_st_date: CURRENT_DATE (today)
     * wfamsh_id: "WFAMSH_01"
     * changed_by: "system"
     * changed_on: CURRENT_TIMESTAMP

7. Result
   - Existing maintenance schedule is updated with current date
   - No duplicate maintenance records created
   - Workflow history is preserved
```

## Database Tables Involved

### tblAssetBRDet (Breakdown Reports)
- Stores breakdown report details
- `decision_code`: "BF01" for prepone breakdowns

### tblWFAssetMaintSch_H (Workflow Headers)
- Stores workflow approval headers
- Status: "IP" (In Process) → "CO" (Completed) or "CA" (Cancelled)

### tblWFAssetMaintSch_D (Workflow Details)
- Stores individual approver steps
- `notes` field contains: `BF01-Breakdown-{ABR_ID}-ExistingSchedule-{AMS_ID}`
- Status progression: "IN" → "AP" → "UA" (approved) or "UR" (rejected)

### tblAssetMaintSch (Maintenance Schedules)
- Stores actual maintenance schedules
- Updated after BF01 workflow approval
- `act_maint_st_date` set to current date after approval

## Status Codes

### Workflow Header Status (tblWFAssetMaintSch_H)
- `IP` - In Process (workflow active)
- `CO` - Completed (all approved)
- `CA` - Cancelled (rejected)

### Workflow Detail Status (tblWFAssetMaintSch_D)
- `IN` - Inactive (waiting for their turn)
- `AP` - Approval Pending (currently needs to approve)
- `UA` - User Approved (approved)
- `UR` - User Rejected (rejected)

### Maintenance Schedule Status (tblAssetMaintSch)
- `IN` - In Progress (active maintenance)
- `CO` - Completed
- `CA` - Cancelled

## Testing Guide

### Test Case 1: BF01 with Existing Schedule and Workflow

**Prerequisites**:
- Asset type has workflow configured (records in tblWFATSeqs)
- Asset has existing maintenance schedule with status "IN"

**Steps**:
1. Create BF01 breakdown for the asset
2. Verify workflow records created in tblWFAssetMaintSch_H and tblWFAssetMaintSch_D
3. Verify notes contain: `BF01-Breakdown-{ABR_ID}-ExistingSchedule-{AMS_ID}`
4. First approver approves
5. Subsequent approvers approve
6. After final approval, verify:
   - Workflow status changed to "CO"
   - Existing maintenance schedule updated
   - `act_maint_st_date` = current date
   - No new maintenance record created

**Expected Result**: Existing schedule updated, no duplicates

### Test Case 2: BF01 without Existing Schedule and Workflow

**Prerequisites**:
- Asset type has workflow configured
- Asset has NO existing maintenance schedule with status "IN"

**Steps**:
1. Create BF01 breakdown
2. Verify workflow created
3. Verify notes contain: `BF01-Breakdown-{ABR_ID}` (no ExistingSchedule reference)
4. Complete approval process
5. After final approval, verify:
   - New maintenance record created in tblAssetMaintSch
   - Status "IN"

**Expected Result**: New schedule created

### Test Case 3: BF01 with Existing Schedule, No Workflow

**Prerequisites**:
- Asset type has NO workflow configured
- Asset has existing maintenance schedule with status "IN"

**Steps**:
1. Create BF01 breakdown
2. Verify NO workflow created
3. Verify existing schedule immediately updated with current date

**Expected Result**: Immediate update without workflow

### Test Case 4: BF01 without Existing Schedule, No Workflow

**Prerequisites**:
- Asset type has NO workflow configured
- Asset has NO existing maintenance schedule

**Steps**:
1. Create BF01 breakdown
2. Verify new maintenance schedule created directly in tblAssetMaintSch
3. Status should be "IN"

**Expected Result**: New schedule created directly

## SQL Queries for Testing

### Check Workflow Records
```sql
-- Check workflow header
SELECT * FROM "tblWFAssetMaintSch_H" 
WHERE asset_id = 'YOUR_ASSET_ID' 
ORDER BY created_on DESC;

-- Check workflow details with notes
SELECT wfamsd_id, wfamsh_id, user_id, sequence, status, notes
FROM "tblWFAssetMaintSch_D"
WHERE wfamsh_id = 'YOUR_WFAMSH_ID'
ORDER BY sequence;
```

### Check Maintenance Schedules
```sql
-- Check maintenance schedule
SELECT ams_id, wfamsh_id, asset_id, status, act_maint_st_date, 
       created_on, changed_on
FROM "tblAssetMaintSch"
WHERE asset_id = 'YOUR_ASSET_ID'
ORDER BY created_on DESC;
```

### Check Breakdown Reports
```sql
-- Check breakdown reports
SELECT abr_id, asset_id, decision_code, status, created_on
FROM "tblAssetBRDet"
WHERE asset_id = 'YOUR_ASSET_ID'
ORDER BY created_on DESC;
```

## Benefits

1. **Proper Approval Control**: BF01 breakdowns now go through proper approval workflow
2. **No Duplicate Records**: Existing schedules are updated instead of creating duplicates
3. **Audit Trail**: Complete workflow history preserved in database
4. **Flexible**: Works with or without workflow configuration
5. **Backward Compatible**: Maintains existing behavior for non-workflow scenarios

## Notes

- The implementation uses pattern matching on notes to identify BF01 breakdowns
- The existing `ams_id` is encoded in the notes for reference during approval
- If the update fails, the system falls back to creating a new record
- All changes are logged with timestamps and system user

## Related Files

- `models/reportbreakdownModel.js` - Breakdown creation logic
- `models/approvalDetailModel.js` - Approval and maintenance record creation
- `models/maintenanceScheduleModel.js` - Workflow helper functions
- `controllers/reportbreakdownController.js` - Breakdown API endpoint
- `controllers/approvalDetailController.js` - Approval API endpoints

