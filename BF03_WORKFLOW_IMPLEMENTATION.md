# BF03 Workflow Implementation Summary

## Overview

This document describes the implementation of workflow-based approval for BF03 (Postpone) breakdowns, where breakdowns require approval through the workflow system before being recorded for the next scheduled maintenance.

## Problem Statement

Previously, BF03 (Postpone fix to next maintenance) breakdowns were NOT creating workflows. The breakdown was simply recorded without any approval process, which was inconsistent with BF01 and BF02 behavior.

## Solution

Now, BF03 breakdowns **always create a workflow for approval** (when the asset type requires workflow). After final approval, the breakdown is recorded but NO maintenance schedule is created or updated - the issue will be handled during the next scheduled maintenance.

---

## Implementation Details

### 1. BF03 Breakdown Creation Logic

**File**: `models/reportbreakdownModel.js`  
**Lines**: 342-406

The BF03 logic has been updated to:

1. **Create workflow when asset type requires workflow** - Similar to BF01 and BF02
2. **Store reference to existing schedule in notes** - The existing `ams_id` is encoded in the workflow detail notes
3. **No immediate changes to schedule** - Unlike BF01 which prepones, BF03 just records the breakdown

#### Key Code Changes:

```javascript
if (decision_code === 'BF03') {
  if (hasWorkflow) {
    // Create workflow for BF03 postpone breakdown
    const noteText = existingSchedule 
      ? `BF03-Breakdown-${abr_id}-ExistingSchedule-${existingSchedule.ams_id}`
      : `BF03-Breakdown-${abr_id}`;
    
    // Create workflow header
    await msModel.insertWorkflowMaintenanceScheduleHeader({
      wfamsh_id,
      maint_type_id: 'MT004', // Breakdown maintenance
      status: 'IP',
      // ... other fields
    });
    
    // Create workflow details for each approver
    // ... workflow detail creation
  } else {
    // No workflow: Just return existing schedule without changes
    if (existingSchedule) {
      maintenanceResult = existingSchedule;
    }
  }
}
```

**Note Format**: 
- With existing schedule: `BF03-Breakdown-{ABR_ID}-ExistingSchedule-{AMS_ID}`
- Without existing schedule: `BF03-Breakdown-{ABR_ID}`

### 2. Workflow Approval Completion Logic

**File**: `models/approvalDetailModel.js`  
**Lines**: 943-950, 1016-1031

Modified the `createMaintenanceRecord()` function to detect and handle BF03 breakdowns:

#### Updated Workflow Query (Lines 943-950):

```sql
-- detect BF01/BF03 breakdown with existing schedule
(
  SELECT d.notes
  FROM "tblWFAssetMaintSch_D" d
  WHERE d.wfamsh_id = wfh.wfamsh_id
    AND d.org_id = $2
    AND (d.notes ILIKE '%BF01-Breakdown%' OR d.notes ILIKE '%BF03-Breakdown%')
  LIMIT 1
) as bf01_notes
```

**Change**: Now detects both BF01 and BF03 breakdowns in workflow notes.

#### BF03 Detection and Handling (Lines 1016-1031):

```javascript
// Check for BF03 breakdown (Postpone)
if (workflowData.bf01_notes && workflowData.bf01_notes.includes('BF03-Breakdown')) {
  isBF03Postpone = true;
  
  // Extract breakdown ID and get breakdown reason
  const abrMatch = workflowData.bf01_notes.match(/BF03-Breakdown-([A-Z0-9]+)/);
  if (abrMatch && abrMatch[1]) {
    breakdownId = abrMatch[1];
    // Get breakdown reason code from database...
  }
  
  // Extract existing schedule ID
  if (workflowData.bf01_notes.includes('ExistingSchedule')) {
    const match = workflowData.bf01_notes.match(/ExistingSchedule-([^-\s]+)/);
    if (match && match[1]) {
      existingAmsId = match[1];
    }
  }
}

// If BF03 with existing schedule, update only wo_id
if (isBF03Postpone && existingAmsId) {
  const updateQuery = `
    UPDATE "tblAssetMaintSch"
    SET wo_id = $1,
        changed_by = 'system',
        changed_on = CURRENT_TIMESTAMP
    WHERE ams_id = $2 AND org_id = $3
    RETURNING ams_id, wo_id
  `;
  
  const updateResult = await pool.query(updateQuery, [workOrderId, existingAmsId, orgId]);
  return existingAmsId;
}
```

**Important**: When a BF03 workflow is approved:
- ✅ Workflow is marked as completed (status = 'CO')
- ✅ Breakdown is recorded in `tblAssetBRDet`
- ✅ If existing schedule exists: `wo_id` is updated with breakdown information
- ❌ NO maintenance schedule is created if none exists
- ❌ Maintenance date is NOT updated (only wo_id changes)
- The breakdown will be addressed during the next scheduled maintenance

---

## Workflow Process Flow

### BF03 Creation Flow

```
1. User creates BF03 breakdown
   - Asset: ASSET001
   - Reason: Minor Issue
   - Decision: BF03 (Postpone to next maintenance)
   ↓
2. System checks if asset type requires workflow
   ↓
3. If YES:
   - Create workflow in tblWFAssetMaintSch_H
     * wfamsh_id: "WFAMSH_10"
     * maint_type_id: "MT004" (Breakdown)
     * status: "IP" (In Process)
   - Create records in tblWFAssetMaintSch_D
     * First approver: status "AP" (Approval Pending)
     * Subsequent approvers: status "IN" (Inactive)
     * notes: "BF03-Breakdown-ABR005-ExistingSchedule-ams003"
   ↓
4. If NO workflow required:
   - Just record breakdown in tblAssetBRDet
   - Return existing schedule without any changes
```

### BF03 Approval Flow

```
1. Approvers approve sequentially
   - First approver approves → status changes to "UA" (User Approved)
   - Next approver's status changes to "AP"
   - Process continues until all approvers complete
   ↓
2. Final Approval (all users approved)
   - checkAndUpdateWorkflowStatus() detects completion
   - Updates tblWFAssetMaintSch_H.status to "CO" (Completed)
   - Calls createMaintenanceRecord()
   ↓
3. createMaintenanceRecord() execution
   - Detects BF03 breakdown from notes
   - Generates work order ID: "WO-WFAMSH_10-ABR005-Minor_Issue"
   - If existing schedule found (ams_id from notes):
     * Updates ONLY wo_id in tblAssetMaintSch
     * Logs: "BF03: wo_id updated successfully"
   - If no existing schedule: does nothing
   ↓
4. Result
   - Workflow is completed and recorded
   - Breakdown is documented in system
   - Existing schedule's wo_id is updated with breakdown information
   - Maintenance date remains unchanged
   - Issue will be addressed in next scheduled maintenance
```

---

## Comparison: BF01 vs BF02 vs BF03

| Feature | BF01 (Prepone) | BF02 (Separate Fix) | BF03 (Postpone) |
|---------|---------------|-------------------|-----------------|
| **Creates Workflow** | ✅ Yes (if required) | ✅ Yes (if required) | ✅ Yes (if required) |
| **Maintenance Type** | MT004 (Breakdown) | MT004 (Breakdown) | MT004 (Breakdown) |
| **Existing Schedule** | Updates date to today | No change | Updates wo_id only |
| **New Schedule** | Creates if none exists | Always creates new | Never creates |
| **wo_id Behavior** | Preserved (not updated) | Auto-generated for new | Updated with breakdown info |
| **After Approval** | Schedule preponed | New schedule created | wo_id updated (if schedule exists) |
| **Use Case** | Urgent fix needed now | Separate breakdown fix | Fix during next maintenance |

---

## Database Tables Involved

### tblAssetBRDet (Breakdown Reports)
- Stores breakdown report details
- `decision_code`: "BF03" for postpone breakdowns

### tblWFAssetMaintSch_H (Workflow Headers)
- Stores workflow approval headers
- Status: "IP" (In Process) → "CO" (Completed) or "CA" (Cancelled)
- For BF03: workflow created and completed, but no maintenance record follows

### tblWFAssetMaintSch_D (Workflow Details)
- Stores individual approver steps
- `notes` field contains: `BF03-Breakdown-{ABR_ID}-ExistingSchedule-{AMS_ID}`
- Status progression: "IN" → "AP" → "UA" (approved) or "UR" (rejected)

### tblAssetMaintSch (Maintenance Schedules)
- Stores actual maintenance schedules
- **BF03 updates wo_id field only** - If existing schedule exists, wo_id is updated with breakdown information
- No new records created
- Maintenance date remains unchanged
- The breakdown will be addressed during the next scheduled maintenance

---

## Testing Guide

### Test Case 1: BF03 Breakdown with Workflow

**Steps**:
1. Find an asset with an asset type that requires workflow
2. Note if the asset has an existing maintenance schedule
3. Create a BF03 breakdown for that asset
4. Verify workflow is created in `tblWFAssetMaintSch_H`
5. Check workflow details in `tblWFAssetMaintSch_D`
6. Approve the workflow through all approvers
7. Check `tblAssetMaintSch` after workflow completion

**Expected Results**:
- ✅ Breakdown recorded in `tblAssetBRDet` with decision_code = 'BF03'
- ✅ Workflow created in `tblWFAssetMaintSch_H` with status = 'IP'
- ✅ Workflow details created with notes containing `BF03-Breakdown-{ABR_ID}`
- ✅ After approval, workflow status changes to 'CO'
- ✅ NO new record in `tblAssetMaintSch`
- ✅ If existing schedule exists: `wo_id` is updated with breakdown information (format: `WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON}`)
- ✅ Maintenance date (`act_maint_st_date`) remains unchanged

**Verification Queries**:

```sql
-- Check BF03 breakdown
SELECT * FROM "tblAssetBRDet" 
WHERE decision_code = 'BF03' 
ORDER BY created_on DESC LIMIT 1;

-- Check workflow created
SELECT * FROM "tblWFAssetMaintSch_H" 
WHERE asset_id = 'YOUR_ASSET_ID' 
AND maint_type_id = 'MT004'
ORDER BY created_on DESC LIMIT 1;

-- Check workflow details
SELECT * FROM "tblWFAssetMaintSch_D" 
WHERE wfamsh_id = 'FOUND_WFAMSH_ID' 
AND notes ILIKE '%BF03-Breakdown%';

-- Verify wo_id updated in existing maintenance schedule
SELECT ams_id, wo_id, act_maint_st_date, changed_on 
FROM "tblAssetMaintSch" 
WHERE asset_id = 'YOUR_ASSET_ID' 
ORDER BY changed_on DESC;
-- Should show wo_id updated with format: WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON}
-- act_maint_st_date should remain unchanged
-- No new records should be created
```

### Test Case 2: BF03 Breakdown without Workflow

**Steps**:
1. Find an asset with an asset type that does NOT require workflow
2. Create a BF03 breakdown for that asset
3. Check `tblAssetMaintSch`

**Expected Results**:
- ✅ Breakdown recorded in `tblAssetBRDet`
- ✅ NO workflow created (asset type doesn't require workflow)
- ✅ Existing schedule (if any) remains unchanged - no wo_id update
- ✅ NO new schedule created

### Test Case 3: Compare BF01 vs BF03 Behavior

**Steps**:
1. Find an asset with existing schedule (status = "IN")
2. Note the current `act_maint_st_date` (e.g., 2024-12-25)
3. Create BF01 breakdown, approve workflow
4. Check the maintenance schedule
5. Create another asset with similar schedule
6. Create BF03 breakdown, approve workflow
7. Compare the results

**Expected Results**:

| Scenario | BF01 Result | BF03 Result |
|----------|-------------|-------------|
| Workflow Created | ✅ Yes | ✅ Yes |
| Workflow Approved | ✅ Yes | ✅ Yes |
| Schedule Date | Updated to today | Unchanged (still 2024-12-25) |
| New Schedule | No (updated existing) | No new schedule |
| wo_id | Preserved (not changed) | Updated with breakdown info |

---

## Important Notes

1. **BF03 now creates workflow** - Previously it didn't create any workflow, now it does (when required by asset type)

2. **wo_id is updated after approval** - Unlike BF01 which preserves wo_id, BF03 updates the wo_id with breakdown information

3. **Only wo_id changes** - Maintenance date and other fields remain unchanged, only wo_id is updated

4. **Breakdown is recorded** - The breakdown is documented in `tblAssetBRDet` and linked to the workflow for tracking

5. **Next scheduled maintenance** - The BF03 breakdown should be reviewed and addressed during the next scheduled maintenance for that asset

6. **Workflow serves as approval** - The workflow ensures that the decision to postpone the fix is approved by relevant stakeholders

7. **Work order tracking** - The wo_id includes breakdown information (format: `WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON}`) for easy tracking

---

## Files Modified

1. **`models/reportbreakdownModel.js`**
   - Lines 342-406: Added BF03 workflow creation logic
   - Similar structure to BF01/BF02 workflow creation
   - Uses note format: `BF03-Breakdown-{ABR_ID}-ExistingSchedule-{AMS_ID}`

2. **`models/approvalDetailModel.js`**
   - Lines 943-950: Updated workflow query to detect BF01/BF03 breakdowns
   - Lines 1016-1049: Added BF03 detection logic to extract breakdown info
   - Lines 1072-1101: Added BF03 wo_id update logic
   - Updates only wo_id when BF03 is detected with existing schedule

---

## Configuration

No configuration changes are required. The system automatically:
- Creates workflow for BF03 when asset type has workflow configured
- Records breakdown in all cases
- Does NOT create/update maintenance schedules for BF03

---

## Rollback Plan

If you need to rollback the BF03 workflow creation:

1. Restore the previous version of `reportbreakdownModel.js` (lines 342-349)
2. Restore the previous version of `approvalDetailModel.js` (lines 943-950, 1016-1031)
3. Any BF03 workflows created after this implementation can be cancelled if needed
4. No database cleanup required - BF03 workflows are valid records

---

## Status Codes Reference

### Workflow Header Status (tblWFAssetMaintSch_H)
- `IP`: In Process (workflow created, pending approvals)
- `CO`: Completed (all approvals done)
- `CA`: Cancelled (workflow cancelled)

### Workflow Detail Status (tblWFAssetMaintSch_D)
- `IN`: Inactive (waiting for previous approver)
- `AP`: Approval Pending (current approver)
- `UA`: User Approved (approved)
- `UR`: User Rejected (rejected)

### Breakdown Decision Codes (tblAssetBRDet)
- `BF01`: Prepone - create/update maintenance immediately
- `BF02`: Separate Fix - create new maintenance schedule
- `BF03`: Postpone - record breakdown, handle in next scheduled maintenance

---

## Date: October 16, 2025

**Implemented by**: AI Assistant  
**Issue Reported**: Workflow not creating for BF03  
**Resolution**: Added workflow creation logic for BF03 similar to BF01/BF02  
**Tested by**: [Pending]

