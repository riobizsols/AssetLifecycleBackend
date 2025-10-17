# Migration Guide: User-Specific to Role-Based Workflows

## Problem

If you created workflows **before** the role-based implementation, they still have `user_id` set in `tblWFAssetMaintSch_D`. This prevents the role-based approval system from working properly.

## Symptoms

1. User cannot approve even though they have the correct role
2. Debug script shows `user_id` is NOT NULL in workflow steps
3. Error: "No pending approval step found for your role"

## Solution

Run the migration script to update existing workflows to be role-based.

### Step 1: Check Current State

```bash
cd AssetLifecycleBackend
node list_users_and_roles.js
```

This will show:
- All users and their roles
- All pending workflows
- Which workflows need approval

### Step 2: Debug a Specific User/Asset

```bash
node debug_role_based_approval.js [emp_int_id] [asset_id]
```

Example:
```bash
node debug_role_based_approval.js EMP_INT_0001 ASS001
```

Look for this in the output:
```
✅ Found 3 workflow step(s):
   ⏳ Seq 10: System Administrator (JR001) - Status: AP
      user_id: EMP_INT_0002  ← If NOT NULL, needs migration
```

### Step 3: Run Migration

```bash
node migrate_to_role_based.js
```

This script will:
1. Show how many workflows need migration
2. Display affected workflows
3. Ask for confirmation
4. Update `user_id` to NULL for pending steps (IN, AP)
5. Verify the migration

**What it does:**
```sql
UPDATE "tblWFAssetMaintSch_D"
SET user_id = NULL
WHERE status IN ('IN', 'AP')
  AND user_id IS NOT NULL
  AND job_role_id IS NOT NULL;
```

**What it does NOT change:**
- Completed steps (UA - User Approved)
- Rejected steps (UR - User Rejected)
- History table (`tblWFAssetMaintHist`)

### Step 4: Verify Migration

Run the debug script again:
```bash
node debug_role_based_approval.js EMP_INT_0001 ASS001
```

Now you should see:
```
✅ Found 3 workflow step(s):
   ⏳ Seq 10: System Administrator (JR001) - Status: AP
      user_id: NULL ✅  ← Migrated successfully!
```

### Step 5: Test Approval

Use your API endpoint or test the approval function directly.

## Before vs After Migration

### Before (User-Specific):
```sql
-- tblWFAssetMaintSch_D
wfamsd_id: WFAMSD_01
job_role_id: JR001
user_id: EMP_INT_0002  ← Specific user assigned
status: AP

-- Only EMP_INT_0002 can approve
```

### After (Role-Based):
```sql
-- tblWFAssetMaintSch_D
wfamsd_id: WFAMSD_01
job_role_id: JR001
user_id: NULL  ← No specific user
status: AP

-- ANY user with role JR001 can approve!
```

## Important Notes

1. **Completed workflows:** Already approved/rejected steps are NOT changed
2. **History preserved:** `tblWFAssetMaintHist` tracks who actually approved
3. **New workflows:** Automatically created with `user_id = NULL`
4. **Safe migration:** Only affects pending steps (IN, AP status)

## Troubleshooting After Migration

### Issue: Still can't approve

**Check 1: User has role?**
```bash
node list_users_and_roles.js
```

**Check 2: Workflow exists and is pending?**
```sql
SELECT wfh.asset_id, wfd.job_role_id, wfd.status, wfd.user_id
FROM "tblWFAssetMaintSch_D" wfd
INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
WHERE wfh.asset_id = 'ASS001';
```

**Check 3: User's role matches workflow?**
```bash
node debug_role_based_approval.js [your_emp_int_id] [asset_id]
```

### Issue: Migration failed

- Check database connection
- Verify table names and columns exist
- Check for database locks
- Review error message carefully

## Rollback (If Needed)

If you need to rollback, you would need to restore from backup. The migration sets `user_id = NULL`, which cannot be automatically reversed (we don't know the original user assignments).

**Prevention:** Test in development environment first!

## For New Systems

If you're setting up a new system, you don't need to run this migration. Just ensure:

1. `maintenanceScheduleController.js` creates workflows with `user_id: null`
2. Users have roles assigned in `tblUserJobRoles`
3. Workflow steps reference `job_role_id` only

## Support

Questions? Check:
1. `ROLE_BASED_WORKFLOW_IMPLEMENTATION.md` - Technical details
2. `ROLE_BASED_WORKFLOW_QUICK_START.md` - User guide
3. `ROLE_BASED_WORKFLOW_SUMMARY.md` - Quick reference

---

**Remember:** After migration, ALL users with the required role can approve workflows, not just specific users!

