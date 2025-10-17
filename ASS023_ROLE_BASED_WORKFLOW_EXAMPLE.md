# Role-Based Workflow Example: ASS023 (Minimax CO2 4.5kg)

## Asset Details
- **Asset ID:** ASS023
- **Asset Name:** Minimax CO2 4.5kg (Fire Extinguisher)
- **Maintenance Required:** Yes
- **Frequency:** 180 days

## How Role-Based Workflow Works for ASS023

### Scenario Setup

**Roles Required for Fire Extinguisher Maintenance:**
1. **Safety Officer** (JR004) - Step 1
2. **Facility Manager** (JR005) - Step 2

**Safety Officers in System:**
- Sarah Johnson (EMP_INT_001)
- Mike Chen (EMP_INT_002)
- Lisa Martinez (EMP_INT_003)
- David Kim (EMP_INT_004)

**Facility Managers in System:**
- Robert Brown (EMP_INT_010)
- Emily Davis (EMP_INT_011)
- James Wilson (EMP_INT_012)

---

## Step-by-Step Workflow Process

### 1. Workflow Creation (System Generates Maintenance Schedule)

**Database: `tblWFAssetMaintSch_H`**
```sql
wfamsh_id: WFAMSH_100
asset_id: ASS023
pl_sch_date: 2025-11-01
status: IN (Initiated)
org_id: ORG001
```

**Database: `tblWFAssetMaintSch_D` - Step 1**
```sql
wfamsd_id: WFAMSD_200
wfamsh_id: WFAMSH_100
job_role_id: JR004      -- Safety Officer ✅
user_id: NULL           -- ❌ NOT USED (always NULL)
sequence: 10
status: AP              -- Approval Pending
org_id: ORG001
```

**Database: `tblWFAssetMaintSch_D` - Step 2**
```sql
wfamsd_id: WFAMSD_201
wfamsh_id: WFAMSH_100
job_role_id: JR005      -- Facility Manager ✅
user_id: NULL           -- ❌ NOT USED (always NULL)
sequence: 20
status: IN              -- Inactive (waiting)
org_id: ORG001
```

---

### 2. Email Notifications Sent

**To: ALL Safety Officers**
```
✉️ → sarah.johnson@company.com
✉️ → mike.chen@company.com
✉️ → lisa.martinez@company.com
✉️ → david.kim@company.com

Subject: 🔔 Workflow Approval Required - Minimax CO2 4.5kg Maintenance

A workflow requires approval from your role: Safety Officer
Asset: ASS023 - Minimax CO2 4.5kg
Due Date: November 1, 2025

Note: ANY Safety Officer can approve this workflow.
[View & Approve Button]
```

---

### 3. Mike Chen Approves (First to Respond)

**Action:** Mike Chen logs in and approves the workflow at 10:30 AM

**Database UPDATE: `tblWFAssetMaintSch_D` - Step 1**
```sql
wfamsd_id: WFAMSD_200
wfamsh_id: WFAMSH_100
job_role_id: JR004      -- Safety Officer
user_id: NULL           -- ✅ STILL NULL (never changes)
sequence: 10
status: UA              -- ✅ Changed to User Approved
notes: "Fire extinguisher inspection approved by Safety Officer"
changed_by: USER_002
changed_on: 2025-10-17 10:30:00
org_id: ORG001
```

**Database INSERT: `tblWFAssetMaintHist`**
```sql
wfamhis_id: WFAMHIS_100
wfamsh_id: WFAMSH_100
wfamsd_id: WFAMSD_200
action_by: EMP_INT_002  -- ✅ Mike Chen (TRACKED HERE)
action: UA              -- User Approved
action_on: 2025-10-17 10:30:00
notes: "Fire extinguisher inspection approved by Safety Officer"
org_id: ORG001
```

**KEY POINT:** 
- `tblWFAssetMaintSch_D.user_id` = NULL (never set)
- `tblWFAssetMaintHist.action_by` = EMP_INT_002 (Mike Chen tracked here)

---

### 4. Other Safety Officers See "Already Approved"

When Sarah, Lisa, or David log in, they see:
```
✅ Maintenance for ASS023 - Already approved by Safety Officer
```

They can view history to see it was Mike Chen who approved:
```sql
SELECT u.full_name, wh.action, wh.action_on
FROM "tblWFAssetMaintHist" wh
JOIN "tblUsers" u ON wh.action_by = u.emp_int_id
WHERE wh.wfamsh_id = 'WFAMSH_100';

Result: Mike Chen | UA | 2025-10-17 10:30:00
```

---

### 5. Workflow Moves to Step 2 (Facility Manager)

**Database UPDATE: `tblWFAssetMaintSch_D` - Step 2**
```sql
wfamsd_id: WFAMSD_201
wfamsh_id: WFAMSH_100
job_role_id: JR005      -- Facility Manager
user_id: NULL           -- ❌ Still NULL
sequence: 20
status: AP              -- ✅ Changed to Approval Pending
org_id: ORG001
```

**Email Notifications Sent to ALL Facility Managers:**
```
✉️ → robert.brown@company.com
✉️ → emily.davis@company.com
✉️ → james.wilson@company.com

Subject: 🔔 Workflow Approval Required - Minimax CO2 4.5kg Maintenance

A workflow requires approval from your role: Facility Manager
Asset: ASS023 - Minimax CO2 4.5kg
Previous Approval: Safety Officer (approved)
Due Date: November 1, 2025

Note: ANY Facility Manager can approve this workflow.
[View & Approve Button]
```

---

### 6. Emily Davis Approves

**Action:** Emily Davis approves at 2:15 PM

**Database UPDATE: `tblWFAssetMaintSch_D` - Step 2**
```sql
wfamsd_id: WFAMSD_201
wfamsh_id: WFAMSH_100
job_role_id: JR005      -- Facility Manager
user_id: NULL           -- ✅ STILL NULL (never changes)
sequence: 20
status: UA              -- ✅ Changed to User Approved
notes: "Approved for maintenance scheduling"
changed_by: USER_011
changed_on: 2025-10-17 14:15:00
org_id: ORG001
```

**Database INSERT: `tblWFAssetMaintHist`**
```sql
wfamhis_id: WFAMHIS_101
wfamsh_id: WFAMSH_100
wfamsd_id: WFAMSD_201
action_by: EMP_INT_011  -- ✅ Emily Davis (TRACKED HERE)
action: UA              -- User Approved
action_on: 2025-10-17 14:15:00
notes: "Approved for maintenance scheduling"
org_id: ORG001
```

---

### 7. Workflow Completed

**Database UPDATE: `tblWFAssetMaintSch_H`**
```sql
wfamsh_id: WFAMSH_100
asset_id: ASS023
status: CO              -- ✅ Changed to Completed
changed_on: 2025-10-17 14:15:00
```

**Maintenance Record Created: `tblAssetMaintSch`**
```sql
ams_id: ams150
wfamsh_id: WFAMSH_100
wo_id: WO-WFAMSH_100
asset_id: ASS023
maint_type_id: MT002
status: IN
act_maint_st_date: 2025-11-01
```

---

## Query: Who Approved ASS023's Workflow?

```sql
SELECT 
  a.asset_id,
  a.text as asset_name,
  jr.text as role_required,
  u.full_name as approved_by,
  wh.action,
  wh.action_on
FROM "tblWFAssetMaintHist" wh
JOIN "tblWFAssetMaintSch_D" wfd ON wh.wfamsd_id = wfd.wfamsd_id
JOIN "tblWFAssetMaintSch_H" wfh ON wh.wfamsh_id = wfh.wfamsh_id
JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
JOIN "tblUsers" u ON wh.action_by = u.emp_int_id
WHERE a.asset_id = 'ASS023'
  AND wh.action = 'UA'
ORDER BY wh.action_on;

-- Result:
-- ASS023 | Minimax CO2 4.5kg | Safety Officer    | Mike Chen    | UA | 2025-10-17 10:30:00
-- ASS023 | Minimax CO2 4.5kg | Facility Manager  | Emily Davis  | UA | 2025-10-17 14:15:00
```

---

## Query: Check Workflow Detail (user_id is NULL)

```sql
SELECT 
  wfd.wfamsd_id,
  wfd.job_role_id,
  jr.text as role_name,
  wfd.user_id,        -- Will show NULL
  wfd.status
FROM "tblWFAssetMaintSch_D" wfd
JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
WHERE wfh.asset_id = 'ASS023';

-- Result:
-- WFAMSD_200 | JR004 | Safety Officer    | NULL | UA
-- WFAMSD_201 | JR005 | Facility Manager  | NULL | UA
```

**Notice:** `user_id` column is NULL for both steps!

---

## Key Takeaways for ASS023

✅ **Role-based notifications:**
- 4 Safety Officers received email
- 3 Facility Managers received email
- Total: 7 people notified for 2 approval steps

✅ **Flexible approval:**
- Mike Chen approved (not Sarah, Lisa, or David)
- Emily Davis approved (not Robert or James)
- First person in each role wins

✅ **user_id field:**
- Always NULL in `tblWFAssetMaintSch_D`
- Never set, never updated

✅ **Audit trail:**
- `tblWFAssetMaintHist` records Mike Chen and Emily Davis
- Full history preserved with timestamps

✅ **No bottlenecks:**
- If Mike was busy, Sarah/Lisa/David could approve
- If Emily was busy, Robert/James could approve
- Fire safety equipment maintenance not delayed!

---

## Summary Table: Data Storage

| Table | Field | Value for ASS023 | Purpose |
|-------|-------|------------------|---------|
| `tblWFAssetMaintSch_D` | `job_role_id` | JR004, JR005 | ✅ Defines which role can approve |
| `tblWFAssetMaintSch_D` | `user_id` | NULL, NULL | ❌ NOT USED (always NULL) |
| `tblWFAssetMaintSch_D` | `status` | UA, UA | ✅ Shows approval status |
| `tblWFAssetMaintHist` | `action_by` | EMP_INT_002, EMP_INT_011 | ✅ Tracks WHO approved |
| `tblWFAssetMaintHist` | `action` | UA, UA | ✅ Tracks action type |
| `tblWFAssetMaintHist` | `action_on` | timestamps | ✅ Tracks when approved |

**Remember:** Only `tblWFAssetMaintHist` tracks who approved. The `user_id` in `tblWFAssetMaintSch_D` is not used.

