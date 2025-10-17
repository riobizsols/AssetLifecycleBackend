# Work Order ID (wo_id) Auto-Generation Implementation Summary

## Overview

This document describes the implementation of automatic `wo_id` generation for maintenance schedules in `tblAssetMaintSch` and the modification to prevent `wo_id` updates when breakdowns are reported for the same asset.

## Tasks Completed

### Task 1: Auto-generate wo_id when line items are added to tblAssetMaintSch

**Objective**: Automatically generate `wo_id` for all records inserted into `tblAssetMaintSch`, similar to how `ams_id` is auto-generated.

### Task 2: Prevent wo_id updates for BF01 and BF03 breakdowns on same asset

**Objective**: When a breakdown is reported for the same asset (BF01 or BF03), the maintenance schedule should be updated but the `wo_id` should remain unchanged.

---

## Implementation Details

### 1. Created Utility Function for wo_id Generation

**File**: `models/maintenanceScheduleModel.js`  
**Lines**: 432-445

Added a new utility function `generateWorkOrderId()` that generates work order IDs in different formats:

```javascript
// Generate work order ID for maintenance schedule
const generateWorkOrderId = (ams_id, wfamsh_id = null, abr_id = null, breakdown_reason = null) => {
    if (wfamsh_id && abr_id) {
        // Format: WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON}
        let workOrderId = `WO-${wfamsh_id}-${abr_id}`;
        if (breakdown_reason) {
            workOrderId = `${workOrderId}-${breakdown_reason.substring(0, 20).replace(/\s/g, '_')}`;
        }
        return workOrderId;
    } else {
        // Format: WO-{AMS_ID} for direct schedules
        return `WO-${ams_id}`;
    }
};
```

**Work Order ID Formats**:
- **Direct schedules** (no workflow): `WO-{AMS_ID}`
  - Example: `WO-ams001`
- **Workflow schedules**: `WO-{WFAMSH_ID}`
  - Example: `WO-WFAMSH_05`
- **Breakdown workflows**: `WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON}`
  - Example: `WO-WFAMSH_05-ABR001-Motor_Failure`

### 2. Updated insertDirectMaintenanceSchedule Function

**File**: `models/maintenanceScheduleModel.js`  
**Lines**: 447-502

Modified the function to auto-generate `wo_id` when inserting direct maintenance schedules:

**Changes**:
- Added `wo_id` generation: `const wo_id = generateWorkOrderId(ams_id);`
- Added `wo_id` column to INSERT statement
- Added `wo_id` value to query parameters

**Impact**: All direct maintenance schedules (bypassing workflow) now automatically get a `wo_id` assigned.

### 3. Updated Workflow Maintenance Record Creation

**File**: `models/approvalDetailModel.js`  
**Lines**: 1014-1028

Enhanced the `createMaintenanceRecord()` function to always generate `wo_id`:

**Before**: Only generated `wo_id` for breakdown workflows  
**After**: Generates `wo_id` for all workflows (breakdown and regular)

```javascript
// Generate work order ID
let workOrderId = null;
if (breakdownId) {
    // Format: WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON} for breakdown workflows
    workOrderId = `WO-${wfamshId}-${breakdownId}`;
    if (breakdownReasonCode) {
        workOrderId = `${workOrderId}-${breakdownReasonCode.substring(0, 20).replace(/\s/g, '_')}`;
    }
} else {
    // Format: WO-{WFAMSH_ID} for regular workflows
    workOrderId = `WO-${wfamshId}`;
}
```

### 4. Removed wo_id Update from BF01 Workflow Logic

**File**: `models/approvalDetailModel.js`  
**Lines**: 1031-1069

Modified the BF01 update logic to NOT update `wo_id`:

**Changes**:
- Removed `wo_id = $6` from UPDATE statement
- Removed `workOrderId` from update parameters
- Changed `RETURNING ams_id` to `RETURNING ams_id, wo_id` to log the unchanged wo_id
- Updated console log to show that wo_id remains unchanged

**Before**:
```sql
UPDATE "tblAssetMaintSch"
SET act_maint_st_date = CURRENT_DATE,
    wfamsh_id = $1,
    maint_type_id = $2,
    vendor_id = $3,
    at_main_freq_id = $4,
    maintained_by = $5,
    wo_id = $6,  -- ❌ This was updating wo_id
    changed_by = 'system',
    changed_on = CURRENT_TIMESTAMP
WHERE ams_id = $7 AND org_id = $8
```

**After**:
```sql
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
RETURNING ams_id, wo_id  -- ✓ wo_id is not updated, just returned
```

### 5. Removed wo_id Update from BF01 Non-Workflow Logic

**File**: `models/reportbreakdownModel.js`  
**Lines**: 247-259

Modified the BF01 non-workflow update logic (when asset type doesn't require workflow):

**Changes**:
- Removed `wo_id = $2` from UPDATE statement
- Removed `appendWorkOrderNote()` function call from parameters
- Added comment explaining that wo_id is not updated

**Before**:
```sql
UPDATE "tblAssetMaintSch"
SET act_maint_st_date = $1,
    wo_id = $2,  -- ❌ This was updating wo_id
    changed_on = CURRENT_TIMESTAMP
WHERE ams_id = $3
```

**After**:
```sql
UPDATE "tblAssetMaintSch"
SET act_maint_st_date = $1,
    changed_on = CURRENT_TIMESTAMP
WHERE ams_id = $2  -- ✓ wo_id remains unchanged
```

### 6. Updated BF03 Logic to Create Workflow and Update wo_id

**File**: `models/reportbreakdownModel.js`  
**Lines**: 342-406

Modified the BF03 (Postpone) logic to create workflow (when required):

**Changes**:
- Added workflow creation logic for BF03 (similar to BF01/BF02)
- Workflow approval updates ONLY wo_id in existing schedule
- Uses note format: `BF03-Breakdown-{ABR_ID}-ExistingSchedule-{AMS_ID}`

**File**: `models/approvalDetailModel.js`  
**Lines**: 1072-1101

Added BF03 wo_id update logic after workflow approval:

**Logic**:
```javascript
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
  
  await pool.query(updateQuery, [workOrderId, existingAmsId, orgId]);
  return existingAmsId;
}
```

**Result**:
- BF03 creates workflow for approval
- After approval: Only wo_id is updated with breakdown information
- Maintenance date remains unchanged

---

## Summary of Changes

### Files Modified

1. **`models/maintenanceScheduleModel.js`**
   - Added `generateWorkOrderId()` function
   - Updated `insertDirectMaintenanceSchedule()` to auto-generate wo_id
   - Exported `generateWorkOrderId` function

2. **`models/approvalDetailModel.js`**
   - Enhanced `createMaintenanceRecord()` to always generate wo_id
   - Removed wo_id update from BF01 workflow update logic

3. **`models/reportbreakdownModel.js`**
   - Removed wo_id update from BF01 non-workflow update logic
   - Removed wo_id update from BF03 logic

### Behavior Changes

| Scenario | Before | After |
|----------|--------|-------|
| **New direct schedule** | No wo_id | Auto-generated: `WO-{AMS_ID}` |
| **New workflow schedule** | wo_id only for breakdowns | Auto-generated for all: `WO-{WFAMSH_ID}` |
| **New breakdown workflow** | Generated with breakdown info | Same (with breakdown info) |
| **BF01 update existing (workflow)** | wo_id updated | wo_id NOT updated ✓ |
| **BF01 update existing (no workflow)** | wo_id updated | wo_id NOT updated ✓ |
| **BF03 postpone (workflow)** | No workflow created | Workflow created, wo_id UPDATED ✓ |
| **BF03 postpone (no workflow)** | wo_id updated | No changes ✓ |

---

## Testing Guide

### Test Case 1: Direct Maintenance Schedule Creation

**Steps**:
1. Create a maintenance schedule for an asset type that doesn't require workflow
2. Check the created record in `tblAssetMaintSch`

**Expected Result**:
- `ams_id` should be auto-generated (e.g., `ams001`)
- `wo_id` should be auto-generated (e.g., `WO-ams001`)
- Both should be visible in the maintenance schedule list

### Test Case 2: Workflow Maintenance Schedule Creation (Regular)

**Steps**:
1. Create a maintenance schedule for an asset type that requires workflow
2. Complete the approval workflow
3. Check the created record in `tblAssetMaintSch`

**Expected Result**:
- `ams_id` should be auto-generated (e.g., `ams002`)
- `wo_id` should be auto-generated with workflow ID (e.g., `WO-WFAMSH_05`)
- Both should be visible after workflow completion

### Test Case 3: BF01 Breakdown with Existing Schedule (Workflow)

**Steps**:
1. Find an asset with an existing maintenance schedule (status = "IN")
2. Note the existing `wo_id` (e.g., `WO-ams001`)
3. Create a BF01 breakdown for that asset
4. Complete the approval workflow
5. Check the updated record in `tblAssetMaintSch`

**Expected Result**:
- Same `ams_id` should be used (no new record created)
- `wo_id` should remain unchanged (still `WO-ams001`) ✓
- `act_maint_st_date` should be updated to current date
- Other fields (vendor, maint_type, etc.) should be updated

**Verification Query**:
```sql
SELECT ams_id, wo_id, act_maint_st_date, wfamsh_id, changed_on
FROM "tblAssetMaintSch"
WHERE asset_id = 'YOUR_ASSET_ID'
ORDER BY changed_on DESC;
```

### Test Case 4: BF01 Breakdown with Existing Schedule (No Workflow)

**Steps**:
1. Find an asset (without workflow requirement) with existing schedule
2. Note the existing `wo_id`
3. Create a BF01 breakdown for that asset
4. Check the updated record immediately

**Expected Result**:
- Same `ams_id` should be used
- `wo_id` should remain unchanged ✓
- `act_maint_st_date` should be preponed to current date

### Test Case 5: BF03 Breakdown without Workflow

**Steps**:
1. Find an asset (without workflow requirement) with existing schedule
2. Note the existing `wo_id`
3. Create a BF03 breakdown for that asset
4. Check the record in `tblAssetMaintSch`

**Expected Result**:
- Same `ams_id` should be used
- `wo_id` should remain unchanged ✓
- `act_maint_st_date` should remain unchanged (not preponed)
- No changes to the maintenance schedule (no workflow, no updates)

### Test Case 6: BF02 Breakdown (Separate Fix)

**Steps**:
1. Find an asset with or without existing schedule
2. Create a BF02 breakdown for that asset
3. If workflow: Complete the approval workflow
4. Check the records in `tblAssetMaintSch`

**Expected Result**:
- A NEW `ams_id` should be created (not updating existing)
- New `wo_id` should be auto-generated
- Original schedule (if any) should remain unchanged

### Test Case 7: BF03 Breakdown (Postpone - Updates wo_id)

**Steps**:
1. Find an asset with existing schedule (status = "IN")
2. Note the current `wo_id` (e.g., `WO-ams001`)
3. Create a BF03 breakdown for that asset
4. Complete the approval workflow
5. Check the updated record in `tblAssetMaintSch`

**Expected Result**:
- Same `ams_id` should be used (no new record created)
- `wo_id` should be UPDATED with breakdown information (e.g., `WO-WFAMSH_12-ABR006-Minor_Issue`) ✓
- `act_maint_st_date` should remain unchanged (not preponed)
- Other fields remain unchanged

**Verification Query**:
```sql
SELECT ams_id, wo_id, act_maint_st_date, changed_on, changed_by
FROM "tblAssetMaintSch"
WHERE asset_id = 'YOUR_ASSET_ID'
ORDER BY changed_on DESC;
```

---

## Database Verification Queries

### Check all maintenance schedules with wo_id

```sql
SELECT 
    ams_id,
    wo_id,
    asset_id,
    wfamsh_id,
    act_maint_st_date,
    status,
    created_on,
    changed_on
FROM "tblAssetMaintSch"
WHERE org_id = 'ORG001'
ORDER BY created_on DESC
LIMIT 20;
```

### Check breakdown-related maintenance schedules

```sql
SELECT 
    ams.ams_id,
    ams.wo_id,
    ams.asset_id,
    ams.act_maint_st_date,
    brd.abr_id,
    brd.decision_code,
    brd.description as breakdown_description
FROM "tblAssetMaintSch" ams
LEFT JOIN "tblAssetBRDet" brd ON brd.asset_id = ams.asset_id
WHERE ams.org_id = 'ORG001'
    AND brd.decision_code IN ('BF01', 'BF02', 'BF03')
ORDER BY ams.changed_on DESC
LIMIT 20;
```

### Track wo_id changes for a specific asset

```sql
SELECT 
    ams_id,
    wo_id,
    act_maint_st_date,
    created_on,
    changed_on,
    changed_by
FROM "tblAssetMaintSch"
WHERE asset_id = 'YOUR_ASSET_ID'
ORDER BY created_on DESC;
```

---

## Important Notes

1. **wo_id is now auto-generated for ALL new maintenance schedules** - You don't need to manually generate or pass wo_id anymore.

2. **wo_id behavior differs for BF01 vs BF03**:
   - **BF01**: wo_id is preserved (not updated) when updating existing schedules
   - **BF03**: wo_id is UPDATED with breakdown information

3. **Work order ID formats are consistent**:
   - Direct schedules: `WO-{AMS_ID}`
   - Workflow schedules: `WO-{WFAMSH_ID}`
   - Breakdown workflows: `WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON}`

4. **BF03 behavior** - BF03 now creates workflow and updates ONLY the wo_id in existing schedules. Maintenance date and other fields remain unchanged.

5. **Backward compatibility** - Existing records with wo_id will not be affected. Only new records and updates will follow the new logic.

---

## Rollback Plan (If Needed)

If you need to rollback these changes:

1. Restore the previous version of the three modified files
2. Check existing `tblAssetMaintSch` records - any records with auto-generated wo_id will still have them (safe to keep)
3. Any breakdowns created after this implementation may need manual review

---

## Technical Notes

- No database migrations required - the `wo_id` column already exists in `tblAssetMaintSch`
- No API changes required - wo_id generation is automatic at the model layer
- Frontend changes not required - the wo_id will automatically appear in responses
- All changes are backward compatible with existing data

---

## Date: October 16, 2025

**Implemented by**: AI Assistant  
**Reviewed by**: [Pending]  
**Tested by**: [Pending]

