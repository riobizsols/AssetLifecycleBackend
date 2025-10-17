# BF01 Work Order with Checklist and Breakdown Reason Implementation

## Overview

This document describes the enhancement to the BF01 breakdown workflow system that creates comprehensive work orders including maintenance checklists and breakdown reason information after approval.

## What Was Added

When a BF01 breakdown workflow is approved, the system now:
1. **Generates a unique work order ID** that includes breakdown information
2. **Links breakdown reason** from the original breakdown report
3. **Includes maintenance checklist** automatically via asset type
4. **Stores all information** in the maintenance schedule for easy access

## Implementation Details

### 1. Work Order ID Generation

**File**: `models/approvalDetailModel.js` (Lines 1014-1024)

Work order IDs are generated in the following format:

```
WO-{WFAMSH_ID}-{ABR_ID}-{BREAKDOWN_REASON}
```

**Example**:
```
WO-WFAMSH_05-ABR001-Motor_Failure
```

**Components**:
- `WO`: Work Order prefix
- `WFAMSH_ID`: Workflow header ID (for traceability)
- `ABR_ID`: Breakdown report ID
- `BREAKDOWN_REASON`: Breakdown reason text (first 20 chars, spaces replaced with underscores)

**Code**:
```javascript
// Generate work order ID for BF01 breakdowns
let workOrderId = null;
if (breakdownId) {
  // Format: WO-{WFAMSH_ID}-{ABR_ID}
  workOrderId = `WO-${wfamshId}-${breakdownId}`;
  if (breakdownReasonCode) {
    // Add breakdown reason to work order ID for reference
    workOrderId = `${workOrderId}-${breakdownReasonCode.substring(0, 20).replace(/\s/g, '_')}`;
  }
  console.log('Generated work order ID:', workOrderId);
}
```

### 2. Breakdown Information Retrieval

**File**: `models/approvalDetailModel.js` (Lines 983-1012)

The system extracts breakdown information from workflow notes and fetches related data:

```javascript
// Extract breakdown ID from notes
const abrMatch = workflowData.bf01_notes.match(/BF01-Breakdown-([A-Z0-9]+)/);
if (abrMatch && abrMatch[1]) {
  breakdownId = abrMatch[1];
  
  // Get breakdown reason code from tblAssetBRDet
  const breakdownQuery = `
    SELECT brd.abr_id, brd.atbrrc_id, brd.description, brc.text as breakdown_reason
    FROM "tblAssetBRDet" brd
    LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
    WHERE brd.abr_id = $1 AND brd.org_id = $2
  `;
  const breakdownResult = await pool.query(breakdownQuery, [breakdownId, orgId]);
  if (breakdownResult.rows.length > 0) {
    breakdownReasonCode = breakdownResult.rows[0].breakdown_reason;
  }
}
```

### 3. Work Order Storage

**File**: `models/approvalDetailModel.js`

#### For Existing Schedules (Lines 1035-1070):
```sql
UPDATE "tblAssetMaintSch"
SET act_maint_st_date = CURRENT_DATE,
    wfamsh_id = $1,
    maint_type_id = $2,
    vendor_id = $3,
    at_main_freq_id = $4,
    maintained_by = $5,
    wo_id = $6,  -- Work order ID with breakdown info
    changed_by = 'system',
    changed_on = CURRENT_TIMESTAMP
WHERE ams_id = $7 AND org_id = $8
```

#### For New Schedules (Lines 1095-1133):
```sql
INSERT INTO "tblAssetMaintSch" (
  ams_id,
  wfamsh_id,
  wo_id,  -- Work order ID with breakdown info
  asset_id,
  maint_type_id,
  vendor_id,
  at_main_freq_id,
  maintained_by,
  notes,
  status,
  act_maint_st_date,
  created_by,
  created_on,
  org_id
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, $13)
```

### 4. Work Order Query Enhancement

**File**: `models/workOrderModel.js` (Lines 86-105 and 201-220)

Enhanced work order queries to include breakdown information:

```sql
-- Get breakdown information if this is a breakdown maintenance
(
    SELECT json_build_object(
        'abr_id', brd.abr_id,
        'breakdown_reason_code', brd.atbrrc_id,
        'breakdown_reason', brc.text,
        'breakdown_description', brd.description,
        'decision_code', brd.decision_code,
        'reported_by', brd.reported_by,
        'reported_on', brd.created_on
    )
    FROM "tblWFAssetMaintSch_D" wfd
    LEFT JOIN "tblAssetBRDet" brd ON wfd.notes ILIKE '%' || brd.abr_id || '%' 
        AND brd.org_id = ams.org_id
    LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
    WHERE wfd.wfamsh_id = ams.wfamsh_id
      AND wfd.org_id = ams.org_id
      AND wfd.notes ILIKE '%breakdown%'
      AND brd.abr_id IS NOT NULL
    LIMIT 1
) as breakdown_info
```

### 5. Checklist Integration

**Automatic via Asset Type**

Checklists are automatically included in work order queries via the existing subquery (already implemented):

```sql
-- Get checklist items for this asset type
(
    SELECT json_agg(
        json_build_object(
            'checklist_id', cl.at_main_checklist_id,
            'text', cl.text,
            'at_main_freq_id', cl.at_main_freq_id
        )
    )
    FROM "tblATMaintCheckList" cl
    WHERE cl.asset_type_id = a.asset_type_id 
    AND cl.org_id = ams.org_id
) as checklist_items
```

## Work Order Response Structure

### GET `/api/work-orders` or `/api/work-orders/:id`

**Response includes:**

```json
{
  "success": true,
  "data": {
    "ams_id": "ams001",
    "wo_id": "WO-WFAMSH_05-ABR001-Motor_Failure",
    "asset_id": "ASSET001",
    "status": "IN",
    "act_maint_st_date": "2024-12-17",
    "wfamsh_id": "WFAMSH_05",
    "maint_type_id": "MT004",
    "vendor_name": "ABC Maintenance",
    "asset_type_name": "Generator",
    
    // Breakdown Information
    "breakdown_info": {
      "abr_id": "ABR001",
      "breakdown_reason_code": "ATBRRC_001",
      "breakdown_reason": "Motor Failure",
      "breakdown_description": "Motor stopped working suddenly",
      "decision_code": "BF01",
      "reported_by": "USER001",
      "reported_on": "2024-12-15T10:30:00.000Z"
    },
    
    // Checklist Items
    "checklist_items": [
      {
        "checklist_id": "CHECKLIST_001",
        "text": "Check motor bearings",
        "at_main_freq_id": "ATMF_001"
      },
      {
        "checklist_id": "CHECKLIST_002",
        "text": "Inspect motor windings",
        "at_main_freq_id": "ATMF_001"
      },
      {
        "checklist_id": "CHECKLIST_003",
        "text": "Test motor cooling system",
        "at_main_freq_id": "ATMF_001"
      }
    ],
    
    // Other details...
    "approval_date": "2024-12-16T14:20:00.000Z",
    "final_approver_name": "John Supervisor"
  }
}
```

## Complete Workflow Process

```
1. User creates BF01 breakdown
   - Asset: ASSET001
   - Reason: Motor Failure (ATBRRC_001)
   - ABR ID: ABR001
   ↓
2. System creates workflow
   - WFAMSH_05 created
   - Notes: "BF01-Breakdown-ABR001-ExistingSchedule-ams001"
   ↓
3. Approval process completes
   - All approvers approve
   - checkAndUpdateWorkflowStatus() triggered
   ↓
4. createMaintenanceRecord() executes
   - Extracts breakdown ID: ABR001
   - Fetches breakdown reason: "Motor Failure"
   - Generates work order ID: "WO-WFAMSH_05-ABR001-Motor_Failure"
   ↓
5. Update/Create maintenance schedule
   - Updates existing ams001 (or creates new)
   - Sets wo_id: "WO-WFAMSH_05-ABR001-Motor_Failure"
   - Sets act_maint_st_date: CURRENT_DATE
   - Sets maint_type_id: MT004 (Breakdown)
   ↓
6. Work order available with:
   ✅ Unique work order ID
   ✅ Breakdown information (reason, description, reporter)
   ✅ Maintenance checklist (from asset type)
   ✅ All relevant asset and vendor details
```

## Database Tables Involved

### tblAssetMaintSch (Maintenance Schedules / Work Orders)
- `ams_id`: Maintenance schedule ID
- `wo_id`: **Work order ID** (NEW: includes breakdown info)
- `wfamsh_id`: Link to workflow
- `asset_id`: Asset being maintained
- `maint_type_id`: Maintenance type (MT004 for breakdowns)
- Other maintenance details...

### tblAssetBRDet (Breakdown Reports)
- `abr_id`: Breakdown report ID
- `atbrrc_id`: Breakdown reason code
- `description`: Breakdown description
- `decision_code`: BF01, BF02, or BF03
- `reported_by`: User who reported

### tblATBRReasonCodes (Breakdown Reason Codes)
- `atbrrc_id`: Reason code ID
- `text`: Reason text (e.g., "Motor Failure")
- `asset_type_id`: Associated asset type

### tblATMaintCheckList (Maintenance Checklists)
- `at_main_checklist_id`: Checklist item ID
- `text`: Checklist item text
- `asset_type_id`: Associated asset type
- `at_main_freq_id`: Maintenance frequency reference

### tblWFAssetMaintSch_D (Workflow Details)
- `notes`: Contains breakdown reference (e.g., "BF01-Breakdown-ABR001")
- Used to link workflow to breakdown

## Testing Guide

### Test Case: BF01 Breakdown Work Order Creation

**Prerequisites**:
- Asset with existing maintenance schedule (status "IN")
- Breakdown reason codes configured for asset type
- Maintenance checklist configured for asset type
- Workflow configured for asset type

**Steps**:

1. **Create BF01 Breakdown**
```bash
POST /api/reportbreakdown/create
{
  "asset_id": "ASSET001",
  "atbrrc_id": "ATBRRC_001",  // Motor Failure
  "reported_by": "USER001",
  "description": "Motor stopped working suddenly",
  "decision_code": "BF01"
}
```

2. **Verify Workflow Created**
```sql
SELECT * FROM "tblWFAssetMaintSch_H" 
WHERE asset_id = 'ASSET001' 
ORDER BY created_on DESC LIMIT 1;

SELECT notes FROM "tblWFAssetMaintSch_D" 
WHERE wfamsh_id = 'WFAMSH_XX'
AND notes ILIKE '%BF01-Breakdown%';
```

3. **Approve Workflow**
```bash
POST /api/approval-detail/approve
{
  "asset_id": "ASSET001",
  "emp_int_id": "USER002",
  "note": "Approved for breakdown maintenance"
}
```
Repeat for all approvers.

4. **Verify Work Order Created**
```sql
SELECT ams_id, wo_id, wfamsh_id, act_maint_st_date, maint_type_id
FROM "tblAssetMaintSch"
WHERE asset_id = 'ASSET001' AND status = 'IN'
ORDER BY changed_on DESC LIMIT 1;
```

**Expected**:
- `wo_id` contains: `WO-WFAMSH_XX-ABR001-Motor_Failure`
- `act_maint_st_date` = current date
- `maint_type_id` = MT004

5. **Verify Work Order Details**
```bash
GET /api/work-orders/{ams_id}
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "wo_id": "WO-WFAMSH_XX-ABR001-Motor_Failure",
    "breakdown_info": {
      "abr_id": "ABR001",
      "breakdown_reason": "Motor Failure",
      "breakdown_description": "Motor stopped working suddenly",
      "decision_code": "BF01"
    },
    "checklist_items": [
      { "text": "Check motor bearings" },
      { "text": "Inspect motor windings" },
      { "text": "Test motor cooling system" }
    ]
  }
}
```

### SQL Testing Queries

```sql
-- Check work order with breakdown info
SELECT 
  ams.ams_id,
  ams.wo_id,
  ams.asset_id,
  ams.act_maint_st_date,
  brd.abr_id,
  brc.text as breakdown_reason
FROM "tblAssetMaintSch" ams
LEFT JOIN "tblWFAssetMaintSch_D" wfd ON ams.wfamsh_id = wfd.wfamsh_id
LEFT JOIN "tblAssetBRDet" brd ON wfd.notes ILIKE '%' || brd.abr_id || '%'
LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
WHERE ams.asset_id = 'ASSET001'
  AND ams.status = 'IN'
ORDER BY ams.created_on DESC;

-- Check checklist for asset type
SELECT 
  cl.at_main_checklist_id,
  cl.text,
  a.asset_type_id
FROM "tblAssetMaintSch" ams
INNER JOIN "tblAssets" a ON ams.asset_id = a.asset_id
INNER JOIN "tblATMaintCheckList" cl ON a.asset_type_id = cl.asset_type_id
WHERE ams.ams_id = 'YOUR_AMS_ID'
ORDER BY cl.at_main_checklist_id;
```

## Benefits

1. **Comprehensive Work Orders**: All breakdown information in one place
2. **Traceability**: Work order ID includes workflow and breakdown IDs
3. **Automatic Checklists**: Maintenance checklist automatically included
4. **Breakdown Context**: Full breakdown reason and description available
5. **Easy Reporting**: Breakdown info easily accessible via work order queries
6. **Vendor Communication**: Complete information for service vendors

## API Endpoints

### Get All Work Orders
```
GET /api/work-orders
```
Returns all work orders with breakdown info and checklists

### Get Work Order by ID
```
GET /api/work-orders/:ams_id
```
Returns single work order with full details

### Response includes:
- Work order ID (with breakdown reference)
- Breakdown information object
- Maintenance checklist array
- Asset details
- Vendor details
- Approval history

## Related Files

- `models/approvalDetailModel.js` - Work order generation logic
- `models/workOrderModel.js` - Work order queries with breakdown info
- `models/reportbreakdownModel.js` - Breakdown creation
- `controllers/workOrderController.js` - Work order API endpoints

## Notes

- Work order IDs are unique and include full breakdown traceability
- Checklists are automatically linked via asset_type_id (no additional config needed)
- Breakdown reason is fetched in real-time from tblAssetBRDet and tblATBRReasonCodes
- All work order information is available through standard work order APIs
- The work order ID format is human-readable and contains key information

