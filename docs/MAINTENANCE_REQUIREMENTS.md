# Requirements for Assets to Enter Maintenance Workflow

This document outlines all the requirements that must be met for an asset to successfully enter the maintenance workflow system.

## Overview

There are **two paths** for assets to enter maintenance:

1. **Direct Maintenance** (`maint_required = false`): Assets go directly into `tblAssetMaintSch` with status 'IN'
2. **Workflow Maintenance** (`maint_required = true`): Assets go through approval workflow via `tblWFAssetMaintSch_H` and `tblWFAssetMaintSch_D`

---

## Path 1: Direct Maintenance (No Workflow)

**When:** `tblAssetTypes.maint_required = false` (or NULL/false)

### Requirements:

1. ✅ **Asset Type Configuration**
   - Asset type must exist in `tblAssetTypes`
   - `maint_required` field should be `false` or `NULL`

2. ✅ **Maintenance Frequency** (Optional but recommended)
   - At least one record in `tblATMaintFreq` for the asset type
   - If missing, `at_main_freq_id` will be `NULL` in the maintenance schedule

3. ✅ **Asset Record**
   - Asset must exist in `tblAssets`
   - Asset must belong to the organization (`org_id`)

**What Happens:**
- Maintenance schedule is created directly in `tblAssetMaintSch`
- Status is set to `'IN'` (In Progress) immediately
- No workflow approval required
- `wfamsh_id` is `NULL` (no workflow header)

---

## Path 2: Workflow Maintenance (With Approval)

**When:** `tblAssetTypes.maint_required = true`

### Requirements:

#### 1. ✅ **Asset Type Configuration**
   - Asset type must exist in `tblAssetTypes`
   - `maint_required` field must be `true`

#### 2. ✅ **Workflow Steps** (`tblWFSteps`)
   - At least one workflow step must exist in `tblWFSteps`
   - Workflow steps define the approval stages (e.g., "Initial Approval", "Final Approval")
   - Example: `wf_steps_id = 'WFS001'`, `text = 'Supervisor Approval'`

#### 3. ✅ **Workflow Sequences** (`tblWFATSeqs`) ⚠️ **CRITICAL**
   - **MUST HAVE** at least one sequence configured for the asset type
   - Links asset types to workflow steps with sequence numbers
   - Required fields:
     - `asset_type_id`: The asset type
     - `wf_steps_id`: The workflow step (from `tblWFSteps`)
     - `seqs_no`: Sequence number (e.g., 10, 20, 30) - determines order
     - `org_id`: Organization ID (must match asset's org_id)
   
   **Example:**
   ```sql
   INSERT INTO "tblWFATSeqs" (wf_at_seqs_id, asset_type_id, wf_steps_id, seqs_no, org_id)
   VALUES ('WFS001', 'AT001', 'WFS001', 10, 'ORG001');
   ```

   **Error if missing:** `"No workflow sequences configured for this asset type"`

#### 4. ✅ **Job Roles for Workflow Steps** (`tblWFJobRole`) ⚠️ **CRITICAL**
   - **MUST HAVE** at least one job role configured for each workflow step used in sequences
   - Links workflow steps to job roles (who can approve)
   - Required fields:
     - `wf_steps_id`: The workflow step
     - `job_role_id`: Job role that can approve (from `tblJobRoles`)
     - `dept_id`: Department (optional, can be NULL)
     - `emp_int_id`: Employee (optional, can be NULL)
     - `org_id`: Organization ID
   
   **Example:**
   ```sql
   INSERT INTO "tblWFJobRole" (wf_job_role_id, wf_steps_id, job_role_id, dept_id, emp_int_id, org_id)
   VALUES ('WJR001', 'WFS001', 'JR001', 'DEPT001', NULL, 'ORG001');
   ```

   **Error if missing:** Workflow details will not be created, and approvals will fail

#### 5. ✅ **Maintenance Frequency** (`tblATMaintFreq`)
   - At least one maintenance frequency record for the asset type
   - Defines maintenance type, frequency, and schedule
   - Required fields:
     - `asset_type_id`: The asset type
     - `maint_type_id`: Type of maintenance (from `tblMaintTypes`)
     - `org_id`: Organization ID

#### 6. ✅ **Maintenance Type** (`tblMaintTypes`)
   - The maintenance type referenced in `tblATMaintFreq` must exist
   - Example: `maint_type_id = 'MT002'` (Preventive Maintenance)

#### 7. ✅ **Asset Record**
   - Asset must exist in `tblAssets`
   - Asset must belong to the organization (`org_id`)
   - Asset should not already have an active maintenance schedule (status 'IN' or 'IP')

**What Happens:**
- Workflow header is created in `tblWFAssetMaintSch_H` with status 'AP' (Action Pending)
- Workflow details are created in `tblWFAssetMaintSch_D` for each sequence step
- Each detail has status 'AP' and is assigned to users with matching job roles
- Users must approve/reject each step in sequence
- After all approvals, maintenance schedule is created in `tblAssetMaintSch` with status 'IN'

---

## Summary Checklist

### For Direct Maintenance (`maint_required = false`):
- [ ] Asset type exists with `maint_required = false`
- [ ] Asset exists in `tblAssets`
- [ ] (Optional) Maintenance frequency configured

### For Workflow Maintenance (`maint_required = true`):
- [ ] Asset type exists with `maint_required = true`
- [ ] **Workflow steps exist** (`tblWFSteps`)
- [ ] **Workflow sequences configured** (`tblWFATSeqs`) ⚠️
- [ ] **Job roles assigned to workflow steps** (`tblWFJobRole`) ⚠️
- [ ] Maintenance frequency configured (`tblATMaintFreq`)
- [ ] Maintenance type exists (`tblMaintTypes`)
- [ ] Asset exists in `tblAssets`
- [ ] Asset doesn't have active maintenance already

---

## Common Issues & Solutions

### Issue 1: "No workflow sequences configured for this asset type"
**Solution:** Add records to `tblWFATSeqs` linking the asset type to workflow steps.

### Issue 2: Workflow details not being created
**Solution:** Ensure `tblWFJobRole` has entries for each `wf_steps_id` used in the sequences.

### Issue 3: No users can see approvals
**Solution:** Check that:
- Job roles in `tblWFJobRole` match user's job roles in `tblEmployees`
- Users have the correct `job_role_id` assigned
- `org_id` matches between workflow configuration and users

### Issue 4: Maintenance not generating automatically
**Solution:** Check:
- Asset type has `maint_required = true`
- Maintenance frequency is configured
- Asset has `purchased_on` date set
- No existing active maintenance schedules

---

## Diagnostic Script

Use the diagnostic script to check configuration:

```bash
node scripts/diagnose-maintenance-details.js [ASSET_ID or ASSET_TYPE_ID]
```

This will show:
- Asset information
- Workflow sequences configured
- Job roles for each workflow step
- Existing workflow headers and details

---

## Database Tables Reference

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `tblAssetTypes` | Asset type configuration | `asset_type_id`, `maint_required` |
| `tblWFSteps` | Workflow step definitions | `wf_steps_id`, `text` |
| `tblWFATSeqs` | Links asset types to workflow steps | `asset_type_id`, `wf_steps_id`, `seqs_no`, `org_id` |
| `tblWFJobRole` | Links workflow steps to job roles | `wf_steps_id`, `job_role_id`, `dept_id`, `emp_int_id`, `org_id` |
| `tblATMaintFreq` | Maintenance frequency configuration | `asset_type_id`, `maint_type_id`, `org_id` |
| `tblMaintTypes` | Maintenance type definitions | `maint_type_id` |
| `tblAssets` | Asset records | `asset_id`, `asset_type_id`, `org_id` |
| `tblWFAssetMaintSch_H` | Workflow maintenance headers | `wfamsh_id`, `asset_id`, `status` |
| `tblWFAssetMaintSch_D` | Workflow maintenance details (approval steps) | `wfamsd_id`, `wfamsh_id`, `wf_steps_id`, `status` |
| `tblAssetMaintSch` | Final maintenance schedules | `ams_id`, `wfamsh_id`, `asset_id`, `status` |

---

## Notes

- **Organization ID (`org_id`)**: Must match across all configuration tables
- **Sequence Numbers (`seqs_no`)**: Determine the order of approval steps (lower numbers = earlier steps)
- **Status Values**: 
  - `'AP'` = Action Pending (awaiting approval)
  - `'IN'` = In Progress (maintenance active)
  - `'CO'` = Completed
  - `'CA'` = Cancelled
  - `'UA'` = User Approved
  - `'UR'` = User Rejected
