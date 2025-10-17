# Role-Based Workflow - Key Points Summary

## ✅ What Changed

### Before (User-Specific)
```
Workflow → Assigned to John Smith (specific user)
         → Only John gets notification
         → Only John can approve
         → Problem: If John is busy → workflow stuck!
```

### After (Role-Based)
```
Workflow → Assigned to "Safety Officer" role
         → ALL 4 Safety Officers get notification
         → ANY Safety Officer can approve
         → First person to approve moves workflow forward
         → System tracks WHO approved in history table
```

## 🎯 Database Fields

### `tblWFAssetMaintSch_D` (Workflow Detail)
```sql
job_role_id: JR004     -- ✅ USED: The role that can approve
user_id: NULL          -- ❌ NOT USED: Always NULL (never set)
status: 'AP'           -- Approval Pending / User Approved / User Rejected
```

### `tblWFAssetMaintHist` (History - AUDIT TRAIL)
```sql
action_by: EMP_INT_002 -- ✅ THIS TRACKS WHO APPROVED/REJECTED
action: 'UA'           -- User Approved / User Rejected
action_on: timestamp   -- When action was taken
```

## 📝 Important Rules

1. **`user_id` in `tblWFAssetMaintSch_D` is NEVER USED**
   - Always NULL when workflow is created
   - Remains NULL after approval/rejection
   - We ONLY use `job_role_id`

2. **To track who approved/rejected:**
   - Check `tblWFAssetMaintHist.action_by`
   - This is the ONLY source of truth

3. **Display shows role names:**
   - "Action pending by any Safety Officer"
   - "Approved by Safety Officer"
   - To see WHO specifically approved → query history table

## 🔍 Query Examples

### See who approved a workflow:
```sql
SELECT 
  u.full_name as approved_by,
  jr.text as role_name,
  wh.action,
  wh.action_on
FROM "tblWFAssetMaintHist" wh
JOIN "tblUsers" u ON wh.action_by = u.emp_int_id
JOIN "tblWFAssetMaintSch_D" wfd ON wh.wfamsd_id = wfd.wfamsd_id
JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
WHERE wh.wfamsh_id = 'WFAMSH_001'
  AND wh.action = 'UA'
ORDER BY wh.action_on;
```

### Check workflow details (will show NULL for user_id):
```sql
SELECT 
  wfd.wfamsd_id,
  wfd.job_role_id,
  jr.text as role_name,
  wfd.user_id,        -- Will be NULL
  wfd.status
FROM "tblWFAssetMaintSch_D" wfd
JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
WHERE wfd.wfamsh_id = 'WFAMSH_001';
```

## 📧 Email Notifications

When workflow step requires "Safety Officer" approval:
- Email sent to: **ALL Safety Officers** (e.g., 4 people)
- Email says: "Any Safety Officer can approve this workflow"
- First person to approve → workflow moves forward
- Others see: "Already approved"

## ✨ Benefits

1. **No bottlenecks** - Multiple people can handle approvals
2. **Better coverage** - Someone always available
3. **Load balancing** - Work distributed across team
4. **Full audit** - History table tracks exactly who approved
5. **Flexibility** - Easy to add/remove users from roles

## ⚠️ Migration

For existing workflows with `user_id` set:
```sql
-- Optional: Clear user_id from pending workflows
UPDATE "tblWFAssetMaintSch_D"
SET user_id = NULL
WHERE status IN ('IN', 'AP')
  AND user_id IS NOT NULL;
```

All **new workflows** automatically use role-based system (user_id = NULL).

---

**Remember:** `user_id` in `tblWFAssetMaintSch_D` = **NOT USED**  
**Audit trail:** `tblWFAssetMaintHist.action_by` = **ONLY SOURCE**

