/**
 * QUICK START - PHASE 1 TESTING
 * 
 * Follow these steps in order for fastest testing
 */

// ============================================================================
// STEP 1: Setup Test Data (2 minutes)
// ============================================================================

/*
Run this in your PostgreSQL database:

-- 1. Create asset type
INSERT INTO "tblAssetTypes" (asset_type_id, asset_type_name, maint_required, int_status, org_id, created_on)
VALUES ('AT_TEST_001', 'Test Vehicle', true, 1, 1, NOW())
ON CONFLICT (asset_type_id) DO UPDATE SET maint_required = true;

-- 2. Create inspection frequency (30 days)
INSERT INTO "tblAAT_Insp_Freq" (aatif_id, at_id, freq, uom, insp_lead_time, org_id, int_status, created_by, created_on)
VALUES ('AATIF_TEST_001', 'AT_TEST_001', 30, 'D', 10, 1, 1, 'SYSTEM', NOW())
ON CONFLICT (aatif_id) DO UPDATE SET freq = 30, uom = 'D';

-- 3. Create test assets (2 will be DUE)
INSERT INTO "tblAssets" (asset_id, asset_type_id, serial_no, purchased_on, int_status, org_id, branch_code, created_on)
VALUES 
  ('ASSET_TEST_001', 'AT_TEST_001', 'SN-001', CURRENT_DATE - INTERVAL '60 days', 1, 1, 'BR001', NOW()),
  ('ASSET_TEST_002', 'AT_TEST_001', 'SN-002', CURRENT_DATE - INTERVAL '45 days', 1, 1, 'BR001', NOW())
ON CONFLICT (asset_id) DO UPDATE SET purchased_on = EXCLUDED.purchased_on;

-- 4. Create job roles (if not exists)
INSERT INTO "tblJobRoles" (job_role_id, job_role_name, org_id, int_status, created_on)
VALUES 
  ('JR_SUPERVISOR', 'Maintenance Supervisor', 1, 1, NOW()),
  ('JR_MANAGER', 'Maintenance Manager', 1, 1, NOW())
ON CONFLICT DO NOTHING;

-- 5. Create workflow steps
INSERT INTO "tblWFInspSteps" (wf_insp_steps_id, org_id, text)
VALUES 
  ('WFIS_001', 1, 'Supervisor Approval'),
  ('WFIS_002', 1, 'Manager Approval')
ON CONFLICT DO NOTHING;

-- 6. Map job roles to steps
INSERT INTO "tblWFInspJobRole" (wf_insp_job_role_id, wf_insp_steps_id, job_role_id, org_id)
VALUES 
  ('WFIJR_001', 'WFIS_001', 'JR_SUPERVISOR', 1),
  ('WFIJR_002', 'WFIS_002', 'JR_MANAGER', 1)
ON CONFLICT DO NOTHING;

-- 7. Create workflow sequences (KEY - enables workflow)
INSERT INTO "tblWFATInspSeqs" (wf_at_insp_seqs_id, at_id, wf_insp_steps_id, seqs_no, org_id)
VALUES 
  ('WFATIS_001', 'AT_TEST_001', 'WFIS_001', 1, 1),
  ('WFATIS_002', 'AT_TEST_001', 'WFIS_002', 2, 1)
ON CONFLICT DO NOTHING;
*/

// ============================================================================
// STEP 2: Start Server
// ============================================================================

// PowerShell:
// cd C:\Users\RIO\Desktop\work\AssetLifecycleBackend
// npm run dev

// Wait for: "Server is listening on port 4000"

// ============================================================================
// STEP 3: Run Test
// ============================================================================

// PowerShell (new terminal):
// cd C:\Users\RIO\Desktop\work\AssetLifecycleBackend
// node test-inspection-generation.js

// ============================================================================
// STEP 4: Check Results in Database
// ============================================================================

/*
-- Should show 2 workflow headers (status='IN')
SELECT wfaiish_id, asset_id, pl_sch_date, status 
FROM "tblWFAATInspSch_H" 
WHERE org_id = 1;

-- Should show 4 workflow details (2 assets × 2 approvers)
-- First approver: status='PN', Second: status='NA'
SELECT h.asset_id, d.sequence, d.status, d.job_role_id
FROM "tblWFAATInspSch_D" d
JOIN "tblWFAATInspSch_H" h ON d.wfaiish_id = h.wfaiish_id
ORDER BY h.asset_id, d.sequence;
*/

// ============================================================================
// EXPECTED RESULTS
// ============================================================================

/*
✅ TEST OUTPUT:
{
  "success": true,
  "stats": {
    "inspectionsCreated": 2,
    "inspectionsSkipped": 0
  }
}

✅ DATABASE:
- tblWFAATInspSch_H: 2 records (status='IN')
- tblWFAATInspSch_D: 4 records (seq 1='PN', seq 2='NA')

✅ SERVER LOGS:
"✅ Asset ASSET_TEST_001 - DUE for inspection"
"✅ Asset ASSET_TEST_002 - DUE for inspection"
"✨ Created WORKFLOW inspection"
*/

// ============================================================================
// CLEANUP (to test again)
// ============================================================================

/*
DELETE FROM "tblWFAATInspSch_D" WHERE org_id = 1;
DELETE FROM "tblWFAATInspSch_H" WHERE org_id = 1;
*/

// ============================================================================
// DATA FLOW DIAGRAM
// ============================================================================

/*
┌─────────────────────────────────────────────────────────────────┐
│                  INSPECTION GENERATION FLOW                      │
└─────────────────────────────────────────────────────────────────┘

INPUT TABLES (READ):
┌──────────────────────┐
│ tblAssetTypes        │  ← maint_required = true
└──────────┬───────────┘
           │
           ↓
┌──────────────────────┐
│ tblAAT_Insp_Freq     │  ← freq = 30, uom = 'D'
└──────────┬───────────┘
           │
           ↓
┌──────────────────────┐
│ tblAssets            │  ← purchased_on >= 20 days ago
└──────────┬───────────┘
           │
           ↓
     ⭐ DECISION ⭐
┌──────────────────────┐
│ tblWFATInspSeqs      │  ← WORKFLOW EXISTS?
└──────────┬───────────┘
           │
    ┌──────┴──────┐
    │             │
   YES           NO
    │             │
    ↓             ↓
┌─────────┐   ┌──────────────┐
│WORKFLOW │   │DIRECT        │
└────┬────┘   └──────┬───────┘
     │               │
     ↓               ↓

OUTPUT TABLES (WRITE):

WORKFLOW PATH:                    DIRECT PATH:
┌──────────────────────┐         ┌──────────────────────┐
│tblWFAATInspSch_H     │         │tblAAT_Insp_Sch       │
│- wfaiish_id          │         │- ais_id              │
│- asset_id            │         │- asset_id            │
│- status = 'IN'       │         │- status = 'PN'       │
└──────────┬───────────┘         └──────────────────────┘
           │
           ↓
┌──────────────────────┐
│tblWFAATInspSch_D     │
│- wfaiisd_id          │
│- sequence = 1        │
│- status = 'PN' ←─────┼── First approver (PENDING)
│                      │
│- sequence = 2        │
│- status = 'NA' ←─────┼── Second approver (NOT ACTIVE)
└──────────────────────┘
*/
