/**
 * STEP-BY-STEP TESTING GUIDE
 * Phase 1: Inspection Schedule Generation
 */

# INSPECTION GENERATION - COMPLETE TEST GUIDE

## 📋 OVERVIEW

This test will verify that the inspection generation system can:
1. ✅ Find asset types requiring inspection
2. ✅ Check inspection frequencies
3. ✅ Identify assets that are DUE for inspection
4. ✅ Detect workflow configuration (tblWFATInspSeqs)
5. ✅ Create workflow inspections (tblWFAATInspSch_H/D)
6. ✅ Skip assets already having in-progress inspections
7. ✅ Apply 10-day lead time rule

---

## 🔧 PREREQUISITES

### Check Database Connection
```bash
# In AssetLifecycleBackend folder
node -e "const db = require('./config/db'); db.query('SELECT NOW()').then(r => console.log('✅ DB Connected:', r.rows[0]))"
```

### Check Required Tables Exist
```bash
node verify-inspection-workflow-tables.js
```

---

## 📝 STEP 1: SETUP TEST DATA (5 minutes)

### Option A: Using pgAdmin or Database Client

1. Open your PostgreSQL client (pgAdmin, DBeaver, etc.)
2. Connect to database: `assetLifecycle` at `103.73.190.251:5432`
3. Open the file: `test-data-setup.sql`
4. **Run sections 1-5A** (lines 1-180) to create:
   - ✅ Asset type with inspection enabled
   - ✅ Inspection frequency (30 days)
   - ✅ 4 test assets (2 DUE, 1 borderline, 1 not due)
   - ✅ Workflow configuration (2-level approval)

### Option B: Using Command Line

```bash
# From AssetLifecycleBackend directory
psql -h 103.73.190.251 -p 5432 -U postgres -d assetLifecycle -f test-data-setup.sql
```

### ✅ VERIFY DATA WAS CREATED

Run this query in your database:
```sql
-- Should show 1 asset type with inspection enabled
SELECT 
  at.asset_type_name,
  aif.freq || ' ' || aif.uom as frequency,
  aif.insp_lead_time as lead_days,
  (SELECT COUNT(*) FROM "tblAssets" WHERE asset_type_id = at.asset_type_id) as asset_count,
  (SELECT COUNT(*) FROM "tblWFATInspSeqs" WHERE at_id = at.asset_type_id) as approval_levels
FROM "tblAssetTypes" at
JOIN "tblAAT_Insp_Freq" aif ON at.asset_type_id = aif.at_id
WHERE at.maint_required = true AND at.org_id = 1;
```

**Expected Result:**
```
asset_type_name | frequency | lead_days | asset_count | approval_levels
----------------|-----------|-----------|-------------|----------------
Test Vehicle    | 30 D      | 10        | 4           | 2
```

### ✅ CHECK WHICH ASSETS ARE DUE

```sql
SELECT 
  a.asset_id,
  a.serial_no,
  CURRENT_DATE - a.purchased_on as days_old,
  CASE 
    WHEN (CURRENT_DATE - a.purchased_on) >= 20 
    THEN '✅ DUE'
    ELSE '⏰ NOT DUE'
  END as inspection_status
FROM "tblAssets" a
WHERE a.asset_type_id = 'AT_TEST_001'
ORDER BY a.purchased_on;
```

**Expected Result:**
```
asset_id        | serial_no    | days_old | inspection_status
----------------|--------------|----------|------------------
ASSET_TEST_001  | SN-TEST-001  | 60       | ✅ DUE
ASSET_TEST_002  | SN-TEST-002  | 45       | ✅ DUE
ASSET_TEST_003  | SN-TEST-003  | 25       | ✅ DUE
ASSET_TEST_004  | SN-TEST-004  | 15       | ⏰ NOT DUE
```

---

## 🚀 STEP 2: START THE SERVER

```bash
cd C:\Users\RIO\Desktop\work\AssetLifecycleBackend
npm run dev
```

**Expected Console Output:**
```
Server is listening on port 4000
📅 [CRON] Maintenance generation: 12:00 AM daily (PAUSED)
📅 [CRON] Workflow escalation: 9:00 AM daily
📅 [CRON] Vendor contract renewal: 8:00 AM daily
```

---

## 🧪 STEP 3: TRIGGER INSPECTION GENERATION

### Option A: Using Test Script (Recommended)

```bash
# In a NEW terminal window
cd C:\Users\RIO\Desktop\work\AssetLifecycleBackend
node test-inspection-generation.js
```

### Option B: Using Postman/Thunder Client

**Request:**
```
POST http://localhost:4000/api/inspection/generate-cron
Content-Type: application/json

{
  "org_id": 1
}
```

### Option C: Using PowerShell

```powershell
$body = @{ org_id = 1 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/inspection/generate-cron" `
  -Method POST `
  -Body $body `
  -ContentType "application/json"
```

---

## 📊 STEP 4: CHECK SERVER LOGS

Watch the server terminal for detailed logs:

**Expected Log Output:**
```
🔍 [INSPECTION CRON] Starting inspection generation for org_id: 1
⏰ [INSPECTION CRON] Timestamp: 2026-02-16T10:30:00.000Z
📋 [INSPECTION CRON] Found 1 asset types requiring inspection

📦 [INSPECTION CRON] Processing: Test Vehicle (ID: AT_TEST_001)
  ⏱️  Frequency: 30 D
  📅 Lead time: 10 days
  🔄 Workflow: YES (2 levels)
  🔧 Individual assets: 4

    ✅ Asset ASSET_TEST_001 - DUE for inspection
       Last: 2025-12-18
       Next: 2026-01-17
       ✨ Created WORKFLOW inspection
       📝 Approver 1: JobRole JR_SUPERVISOR (PN)
       📝 Approver 2: JobRole JR_MANAGER (NA)

    ✅ Asset ASSET_TEST_002 - DUE for inspection
       Last: 2026-01-02
       Next: 2026-02-01
       ✨ Created WORKFLOW inspection
       📝 Approver 1: JobRole JR_SUPERVISOR (PN)
       📝 Approver 2: JobRole JR_MANAGER (NA)

    ✅ Asset ASSET_TEST_003 - DUE for inspection
       Last: 2026-01-22
       Next: 2026-02-21
       ✨ Created WORKFLOW inspection
       📝 Approver 1: JobRole JR_SUPERVISOR (PN)
       📝 Approver 2: JobRole JR_MANAGER (NA)

    ⏰ Asset ASSET_TEST_004 - Not yet due (create on: 2026-02-11)

✅ [INSPECTION CRON] Completed in 0.45s
📊 [INSPECTION CRON] Summary:
   - Asset Types: 1
   - Assets: 4
   - Groups: 0
   - Inspections Created: 3
   - Inspections Skipped: 1
   - Errors: 0
```

---

## ✅ STEP 5: VERIFY DATABASE CHANGES

### 5.1 Check Workflow Headers Created

```sql
SELECT 
  wfaiish_id,
  asset_id,
  pl_sch_date as scheduled_date,
  status,
  created_by,
  created_on
FROM "tblWFAATInspSch_H"
WHERE org_id = 1
ORDER BY created_on DESC;
```

**Expected Result:** 3 records
```
wfaiish_id         | asset_id        | scheduled_date | status | created_by | created_on
-------------------|-----------------|----------------|--------|------------|-------------------------
WFAIISH_17xxx_xxx  | ASSET_TEST_003  | 2026-02-21     | IN     | SYSTEM     | 2026-02-16 10:30:00
WFAIISH_17xxx_xxx  | ASSET_TEST_002  | 2026-02-01     | IN     | SYSTEM     | 2026-02-16 10:30:00
WFAIISH_17xxx_xxx  | ASSET_TEST_001  | 2026-01-17     | IN     | SYSTEM     | 2026-02-16 10:30:00
```

Status = **'IN'** (Initiated) ✅

### 5.2 Check Workflow Details (Approvers) Created

```sql
SELECT 
  h.asset_id,
  d.wfaiisd_id,
  d.job_role_id,
  d.sequence,
  d.status,
  jr.job_role_name
FROM "tblWFAATInspSch_D" d
JOIN "tblWFAATInspSch_H" h ON d.wfaiish_id = h.wfaiish_id
LEFT JOIN "tblJobRoles" jr ON d.job_role_id = jr.job_role_id
WHERE d.org_id = 1
ORDER BY h.asset_id, d.sequence;
```

**Expected Result:** 6 records (3 assets × 2 approvers each)
```
asset_id        | wfaiisd_id      | job_role_id   | sequence | status | job_role_name
----------------|-----------------|---------------|----------|--------|----------------------
ASSET_TEST_001  | WFAIISD_xxx_1   | JR_SUPERVISOR | 1        | PN     | Maintenance Supervisor
ASSET_TEST_001  | WFAIISD_xxx_2   | JR_MANAGER    | 2        | NA     | Maintenance Manager
ASSET_TEST_002  | WFAIISD_xxx_1   | JR_SUPERVISOR | 1        | PN     | Maintenance Supervisor
ASSET_TEST_002  | WFAIISD_xxx_2   | JR_MANAGER    | 2        | NA     | Maintenance Manager
ASSET_TEST_003  | WFAIISD_xxx_1   | JR_SUPERVISOR | 1        | PN     | Maintenance Supervisor
ASSET_TEST_003  | WFAIISD_xxx_2   | JR_MANAGER    | 2        | NA     | Maintenance Manager
```

**Status Explanation:**
- **'PN'** (Pending) - First approver, active for approval ✅
- **'NA'** (Not Active) - Subsequent approvers, waiting ✅

### 5.3 Check Direct Inspections (Should be EMPTY)

```sql
SELECT * FROM "tblAAT_Insp_Sch" WHERE org_id = 1;
```

**Expected Result:** 0 records (because we have workflow configured)

---

## 🔄 STEP 6: TEST DUPLICATE PREVENTION (Run Again)

```bash
# Run the test script again
node test-inspection-generation.js
```

**Expected Result:**
```
📊 SUMMARY:
   Inspections Created: 0
   Inspections Skipped: 3
```

**Server Logs Should Show:**
```
    ⏭️  Asset ASSET_TEST_001 - Already has in-progress inspection (IN)
    ⏭️  Asset ASSET_TEST_002 - Already has in-progress inspection (IN)
    ⏭️  Asset ASSET_TEST_003 - Already has in-progress inspection (IN)
```

✅ **Duplicate prevention working!**

---

## 🧪 STEP 7: TEST DIRECT INSPECTION (No Workflow)

### 7.1 Delete Workflow Configuration

```sql
DELETE FROM "tblWFATInspSeqs" WHERE at_id = 'AT_TEST_001';
```

### 7.2 Clear Previous Inspection Records

```sql
DELETE FROM "tblWFAATInspSch_D" WHERE org_id = 1;
DELETE FROM "tblWFAATInspSch_H" WHERE org_id = 1;
```

### 7.3 Trigger Generation Again

```bash
node test-inspection-generation.js
```

### 7.4 Check Direct Inspections Created

```sql
SELECT 
  ais_id,
  asset_id,
  pl_sch_date,
  status,
  created_by
FROM "tblAAT_Insp_Sch"
WHERE org_id = 1
ORDER BY created_on DESC;
```

**Expected Result:** 3 records in tblAAT_Insp_Sch
```
ais_id          | asset_id        | pl_sch_date | status | created_by
----------------|-----------------|-------------|--------|------------
AIS_xxx_xxx     | ASSET_TEST_003  | 2026-02-21  | PN     | SYSTEM
AIS_xxx_xxx     | ASSET_TEST_002  | 2026-02-01  | PN     | SYSTEM
AIS_xxx_xxx     | ASSET_TEST_001  | 2026-01-17  | PN     | SYSTEM
```

Status = **'PN'** (Pending) ✅

### 7.5 Verify NO Workflow Records

```sql
SELECT COUNT(*) FROM "tblWFAATInspSch_H" WHERE org_id = 1;
SELECT COUNT(*) FROM "tblWFAATInspSch_D" WHERE org_id = 1;
```

**Expected Result:** Both should be 0

---

## 📋 TABLES AFFECTED (SUMMARY)

### ✅ TABLES READ (Input)
1. **tblAssetTypes** - Asset types requiring inspection
2. **tblAAT_Insp_Freq** - Inspection frequencies
3. **tblAssets** - Individual assets
4. **tblWFATInspSeqs** - Workflow configuration ⭐ KEY
5. **tblWFInspSteps** - Workflow steps
6. **tblWFInspJobRole** - Job role mappings
7. **tblJobRoles** - Job role details

### ✅ TABLES WRITTEN (Output)

**IF WORKFLOW EXISTS:**
- **tblWFAATInspSch_H** - Header records (status='IN')
- **tblWFAATInspSch_D** - Detail records (1st='PN', rest='NA')

**IF NO WORKFLOW:**
- **tblAAT_Insp_Sch** - Direct inspection records (status='PN')

---

## 🎯 SUCCESS CRITERIA

✅ **Phase 1 is successful if:**

1. ✅ Server starts without errors
2. ✅ API endpoint responds with 200 status
3. ✅ Correct number of inspections created (3 in our test)
4. ✅ Workflow records created with correct statuses
5. ✅ First approver has status='PN', others='NA'
6. ✅ Duplicate prevention works (second run creates 0)
7. ✅ Direct inspection works when no workflow
8. ✅ Server logs show detailed processing

---

## 🧹 CLEANUP (Reset for Re-testing)

```sql
-- Clear generated records
DELETE FROM "tblWFAATInspSch_D" WHERE org_id = 1;
DELETE FROM "tblWFAATInspSch_H" WHERE org_id = 1;
DELETE FROM "tblAAT_Insp_Sch" WHERE org_id = 1;

-- Optionally clear test data
DELETE FROM "tblWFATInspSeqs" WHERE at_id = 'AT_TEST_001';
DELETE FROM "tblWFInspJobRole" WHERE wf_insp_job_role_id LIKE 'WFIJR_%';
DELETE FROM "tblWFInspSteps" WHERE wf_insp_steps_id LIKE 'WFIS_%';
DELETE FROM "tblAssets" WHERE asset_id LIKE 'ASSET_TEST_%';
DELETE FROM "tblAAT_Insp_Freq" WHERE aatif_id = 'AATIF_TEST_001';
DELETE FROM "tblAssetTypes" WHERE asset_type_id = 'AT_TEST_001';
```

---

## 🐛 TROUBLESHOOTING

### Issue: "No asset types require inspection"
**Solution:** Run this:
```sql
UPDATE "tblAssetTypes" 
SET maint_required = true 
WHERE asset_type_id = 'AT_TEST_001';
```

### Issue: "No inspection frequency configured"
**Solution:** Check tblAAT_Insp_Freq has record with correct at_id

### Issue: "Server not starting"
**Solution:** Check error logs:
```powershell
Get-Content logs/error.log -Tail 50
```

### Issue: "No inspections created"
**Solution:** Check assets have old enough purchase dates:
```sql
SELECT asset_id, purchased_on, CURRENT_DATE - purchased_on as days_old
FROM "tblAssets" 
WHERE asset_type_id = 'AT_TEST_001';
```

---

## ✅ NEXT STEPS

Once Phase 1 testing is complete and working:
- **Phase 2:** Approval workflow with technician selection
- **Phase 3:** Cron integration
- **Phase 4:** Event logging and production readiness
