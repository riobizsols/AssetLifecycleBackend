# Inspection Scheduling - Database Tables Reference

## Overview
This document lists all tables involved in the inspection scheduling process.

---

## 📖 TABLES REQUIRED (READ FROM) - For Scheduling Logic

### 1. **tblAssetTypes**
- **Purpose**: Get asset types that require inspection
- **Key Columns Used**:
  - `asset_type_id` - Asset type identifier
  - `text` - Asset type name
  - `maint_required` - Flag indicating if inspection is required
  - `int_status` - Active status (1 = active)
  - `org_id` - Organization identifier

### 2. **tblAAT_Insp_Freq**
- **Purpose**: Get inspection frequency configuration for each asset type
- **Key Columns Used**:
  - `aatif_id` - Inspection frequency ID
  - `aatic_id` - Link to inspection checklist
  - `freq` - Frequency value (e.g., 30)
  - `uom` - Unit of measure ID (references tblUom)
  - `org_id` - Organization identifier
  - `int_status` - Active status

### 3. **tblAATInspCheckList**
- **Purpose**: Links asset types to inspection checklists
- **Key Columns Used**:
  - `aatic_id` - Checklist ID
  - `at_id` - Asset type ID
  - Links inspection frequency to specific asset types

### 4. **tblUom**
- **Purpose**: Convert UOM ID to actual unit (D=Days, M=Months, Y=Years)
- **Key Columns Used**:
  - `UOM_id` - UOM identifier (e.g., 'UOM001')
  - `UOM` - Actual unit value (e.g., 'D', 'M', 'Y')

### 5. **tblAssets**
- **Purpose**: Get individual assets that need inspection
- **Key Columns Used**:
  - `asset_id` - Asset identifier
  - `asset_type_id` - Link to asset type
  - `serial_number` - Asset serial number
  - `purchased_on` - Purchase date (used to calculate next inspection)
  - `current_status` - Asset status ('ACTIVE', 'IN_USE')
  - `group_id` - Asset group (NULL for individual assets)
  - `branch_id` - Branch location
  - `purchase_vendor_id` - Vendor ID
  - `org_id` - Organization identifier

### 6. **tblWFATInspSeqs**
- **Purpose**: Get workflow approval sequence for inspection
- **Key Columns Used**:
  - `wfatis_id` - Workflow sequence ID
  - `asset_type_id` - Asset type this workflow applies to
  - `wf_steps_id` - Workflow step ID (e.g., 'WFIS001', 'WFIS002')
  - `seqs_no` - Sequence number (1, 2, 3, etc.)

### 7. **tblWFInspJobRole**
- **Purpose**: Get job role assignment for each workflow step
- **Key Columns Used**:
  - `wf_insp_steps_id` - Workflow step ID
  - `job_role_id` - Job role that needs to approve
  - `org_id` - Organization identifier

### 8. **tblWFAATInspSch_H** (Check for Existing)
- **Purpose**: Check if inspection already scheduled (avoid duplicates)
- **Key Columns Used**:
  - `wfaiish_id` - Inspection header ID
  - `asset_id` - Asset being inspected
  - `pl_sch_date` - Planned scheduled date
  - `status` - Inspection status

### 9. **tblAAT_Insp_Sch** (Check for Existing)
- **Purpose**: Check if direct inspection already exists
- **Key Columns Used**:
  - `ais_id` - Direct inspection ID
  - `asset_id` - Asset being inspected
  - `act_insp_st_date` - Actual inspection start date
  - `act_insp_end_date` - Actual inspection end date
  - `status` - Inspection status

---

## ✍️ TABLES INSERTED INTO (WRITE TO) - When Creating Schedule

### 1. **tblWFAATInspSch_H** (WORKFLOW INSPECTION HEADERS)
- **Purpose**: Store inspection schedule header for workflow-based inspections
- **Columns Inserted**:
  - `wfaiish_id` - Generated unique ID (e.g., 'WFAIISH_935399_745')
  - `aatif_id` - Inspection frequency ID
  - `asset_id` - Asset being inspected
  - `vendor_id` - Vendor ID
  - `pl_sch_date` - Planned scheduled date
  - `branch_code` - Branch code
  - `status` - 'IN' (Initiated)
  - `created_by` - User who created the schedule
  - `created_on` - Creation timestamp
  - `org_id` - Organization ID
  - `branch_id` - Branch ID

### 2. **tblWFAATInspSch_D** (WORKFLOW INSPECTION DETAILS)
- **Purpose**: Store approval workflow levels for each inspection
- **Columns Inserted**:
  - `wfaiisd_id` - Generated unique ID (e.g., 'WFAIISD_936145_123')
  - `wfaiish_id` - Foreign key to header table
  - `job_role_id` - Job role that needs to approve this level
  - `seq_no` - Sequence number (1, 2, 3, etc.)
  - `status` - 'PN' (Pending) for first level, 'NA' (Not Active) for others
  - `created_by` - User who created
  - `created_on` - Creation timestamp
  - `org_id` - Organization ID
  - `branch_id` - Branch ID

**Note**: For each header, multiple detail records are created (one per approval level)

### 3. **tblAAT_Insp_Sch** (DIRECT INSPECTION SCHEDULES)
- **Purpose**: Store direct inspection schedules (no workflow approval required)
- **Columns Inserted**:
  - `ais_id` - Generated unique ID
  - `aatif_id` - Inspection frequency ID
  - `asset_id` - Asset being inspected
  - `vendor_id` - Vendor ID
  - `act_insp_st_date` - Actual inspection start date
  - `status` - Inspection status
  - `created_by` - User who created
  - `created_on` - Creation timestamp
  - `org_id` - Organization ID
  - `branch_id` - Branch ID

**Note**: This table is used when asset type doesn't have workflow approval configured

---

## 🔄 INSPECTION SCHEDULING PROCESS FLOW

```
1. READ: tblAssetTypes
   └─> Get asset types requiring inspection (maint_required = true)

2. READ: tblAAT_Insp_Freq + tblAATInspCheckList + tblUom
   └─> Get inspection frequency (e.g., 30 Days)

3. READ: tblAssets
   └─> Get all active assets for the asset type

4. READ: tblWFATInspSeqs
   └─> Get workflow approval sequence (if configured)
   
5. If Workflow Exists:
   ├─> READ: tblWFInspJobRole (get job roles for each step)
   ├─> CHECK: tblWFAATInspSch_H (avoid duplicates)
   ├─> WRITE: tblWFAATInspSch_H (create inspection header)
   └─> WRITE: tblWFAATInspSch_D (create approval levels - one per workflow step)

6. If No Workflow:
   ├─> CHECK: tblAAT_Insp_Sch (avoid duplicates)
   └─> WRITE: tblAAT_Insp_Sch (create direct inspection)
```

---

## 📊 SUMMARY

### Tables Required (9 tables):
1. tblAssetTypes
2. tblAAT_Insp_Freq
3. tblAATInspCheckList
4. tblUom
5. tblAssets
6. tblWFATInspSeqs
7. tblWFInspJobRole
8. tblWFAATInspSch_H (check existing)
9. tblAAT_Insp_Sch (check existing)

### Tables Inserted Into (3 tables):
1. **tblWFAATInspSch_H** - Inspection headers (with workflow)
2. **tblWFAATInspSch_D** - Approval workflow details (multiple per header)
3. **tblAAT_Insp_Sch** - Direct inspections (no workflow)

---

## 📝 EXAMPLE: Current Implementation

For **Asset Type: AT001 (Laptop)** with **17 assets**:

**READ FROM:**
- tblAssetTypes: Found AT001 requires inspection
- tblAAT_Insp_Freq: Found 30-day frequency (via AATIC_T01)
- tblUom: Converted 'UOM001' → 'D' (Days)
- tblAssets: Found 17 active assets
- tblWFATInspSeqs: Found 2 approval levels (WFIS001, WFIS002)
- tblWFInspJobRole: Found JR001 for level 1, JR002 for level 2

**INSERTED INTO:**
- tblWFAATInspSch_H: 17 records (one per asset)
- tblWFAATInspSch_D: 34 records (17 assets × 2 approval levels)
  - Level 1 (JR001): Status 'PN' (Pending)
  - Level 2 (JR002): Status 'NA' (Not Active)

---

## 🔗 TABLE RELATIONSHIPS

```
tblAssetTypes (asset_type_id)
    ↓
    ├─> tblAAT_Insp_Freq.aatic_id → tblAATInspCheckList.aatic_id
    │   └─> tblAAT_Insp_Freq.uom → tblUom.UOM_id
    │
    ├─> tblAssets (asset_type_id)
    │   └─> Used to find assets needing inspection
    │
    └─> tblWFATInspSeqs (asset_type_id)
        └─> tblWFInspJobRole (wf_insp_steps_id)

CREATES:
tblWFAATInspSch_H (wfaiish_id)
    └─> tblWFAATInspSch_D (wfaiish_id) [Foreign Key]
```

---

## 📌 KEY POINTS

1. **Workflow vs Direct**: 
   - If `tblWFATInspSeqs` has records → Use workflow (tblWFAATInspSch_H/D)
   - If no workflow → Use direct inspection (tblAAT_Insp_Sch)

2. **Duplicate Prevention**:
   - Checks existing records in target tables before inserting
   - Compares asset_id and scheduled dates

3. **Approval Levels**:
   - Each workflow step creates one detail record
   - First level: Status 'PN' (Pending - active)
   - Other levels: Status 'NA' (Not Active - waiting)

4. **Date Calculation**:
   - Uses asset `purchased_on` date + inspection frequency
   - Converts UOM to days (D=1, M=30, Y=365)
   - Calculates next inspection date

---

Generated: February 16, 2026
