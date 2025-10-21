# Role-Based Notification System Implementation

## Overview
The maintenance approval and notification system has been **fully implemented** with role-based workflows. The system uses `job_role_id` internally while accepting `emp_int_id` as input parameters for convenience.

## How It Works

### 1. Data Flow
```
Frontend (emp_int_id) 
    ↓
Backend API receives emp_int_id
    ↓
Lookup user_id from tblUsers WHERE emp_int_id = ?
    ↓
Fetch job_role_ids from tblUserJobRoles WHERE user_id = ?
    ↓
Query workflows WHERE job_role_id IN (user's roles)
    ↓
Return results to frontend
```

### 2. Key Database Tables

#### tblUsers
- Stores user information
- `emp_int_id`: Employee internal ID
- `user_id`: System user ID

#### tblUserJobRoles
- Maps users to their job roles (many-to-many)
- `user_id`: Reference to tblUsers
- `job_role_id`: Reference to tblJobRoles

#### tblJobRoles
- Defines job roles in the system
- `job_role_id`: Primary key
- `text`: Role name (e.g., "Supervisor", "Manager")

#### tblWFAssetMaintSch_D (Workflow Detail)
- Stores workflow approval steps
- `job_role_id`: The role required to approve this step (NOT user_id!)
- `status`: 'AP' (Action Pending), 'UA' (User Approved), etc.
- `sequence`: Order of approval

#### tblWFAssetMaintSch_H (Workflow Header)
- Stores workflow header information
- `wfamsh_id`: Unique workflow ID
- `asset_id`: Asset requiring maintenance
- `pl_sch_date`: Planned schedule date
- `status`: Overall workflow status

## API Endpoints

### 1. Get User Notifications
**Endpoint:** `GET /api/notifications/user/:emp_int_id`

**How it works:**
- Accepts `emp_int_id` as URL parameter
- Queries `tblUsers` to get `user_id`
- Queries `tblUserJobRoles` to get all `job_role_id` for this user
- Returns all workflows where:
  - User has ANY of the required job roles
  - Workflow status is IN ('IN', 'IP', 'AP')
  - Workflow header status is IN ('IN', 'IP', 'CO')

**SQL Logic (Simplified):**
```sql
SELECT DISTINCT wfh.*
FROM "tblWFAssetMaintSch_H" wfh
INNER JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
WHERE EXISTS (
  SELECT 1 
  FROM "tblUserJobRoles" ujr
  INNER JOIN "tblUsers" u ON ujr.user_id = u.user_id
  WHERE wfd.job_role_id = ujr.job_role_id
    AND u.emp_int_id = $emp_int_id
    AND wfd.status IN ('IN', 'IP', 'AP')
)
```

### 2. Get Maintenance Approvals
**Endpoint:** `GET /api/approval-detail/maintenance-approvals`

**How it works:**
- Gets `emp_int_id` from JWT token (`req.user.emp_int_id`)
- Same logic as notifications endpoint
- Returns maintenance items where user has approval rights

**Implementation:** `AssetLifecycleManagementBackend/models/approvalDetailModel.js:831`

```javascript
const getMaintenanceApprovals = async (empIntId, orgId = 'ORG001') => {
  // Step 1: Get user_id from emp_int_id
  const userQuery = `SELECT user_id FROM "tblUsers" WHERE emp_int_id = $1 AND int_status = 1`;
  const userResult = await pool.query(userQuery, [empIntId]);
  const userId = userResult.rows[0].user_id;
  
  // Step 2: Get all job_role_ids for this user
  const rolesQuery = `SELECT job_role_id FROM "tblUserJobRoles" WHERE user_id = $1`;
  const rolesResult = await pool.query(rolesQuery, [userId]);
  const userRoleIds = rolesResult.rows.map(r => r.job_role_id);
  
  // Step 3: Query workflows where job_role_id matches user's roles
  const query = `
    SELECT DISTINCT ...
    FROM "tblWFAssetMaintSch_H" wfh
    INNER JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
    WHERE wfd.job_role_id = ANY($2::varchar[])
      AND wfd.status IN ('IN', 'IP', 'UA', 'UR', 'AP')
  `;
  
  return await pool.query(query, [orgId, userRoleIds]);
};
```

### 3. Get Approval Detail by WFAMSH ID
**Endpoint:** `GET /api/approval-detail/workflow/:wfamshId`

**How it works:**
- Accepts `wfamshId` (workflow ID) as URL parameter
- Returns complete workflow details including all approval steps
- Shows job role names (not individual users)
- Displays current approver based on `status = 'AP'`

**Frontend Usage:** `http://localhost:5173/approval-detail/WFAMSH_06`

## Frontend Implementation

### 1. Notification Panel
**File:** `AssetLifecycleManagementFrontend/src/components/dashboardModules/NotificationsPanel.jsx`

**Key Code:**
```javascript
const fetchNotifications = async () => {
  const url = `/notifications/user/${user.emp_int_id}`;
  const response = await API.get(url);
  const notifications = response.data.data || [];
  // ... transform and display
};
```

### 2. All Notifications Page
**File:** `AssetLifecycleManagementFrontend/src/components/AllNotifications.jsx`

Same implementation as NotificationsPanel.

### 3. Maintenance Approval Page
**File:** `AssetLifecycleManagementFrontend/src/pages/MaintenanceApproval.jsx`

**Key Code:**
```javascript
const fetchMaintenanceApprovals = async () => {
  const res = await API.get("/approval-detail/maintenance-approvals");
  // The API uses emp_int_id from JWT token internally
  // Frontend doesn't need to pass it explicitly
};
```

### 4. Approval Detail Page
**File:** `AssetLifecycleManagementFrontend/src/components/MaintenanceApprovalDetail.jsx`

**Key Code:**
```javascript
const fetchApprovalDetail = async () => {
  const timestamp = Date.now();
  const response = await API.get(`/approval-detail/workflow/${id}?t=${timestamp}`);
  // ... display workflow steps, current approver, etc.
};
```

## Benefits of Role-Based Approach

### 1. **Flexibility**
- Multiple users can have the same role
- One user can have multiple roles
- Easy to reassign responsibilities

### 2. **Scalability**
- Add/remove users without changing workflows
- Workflows define role requirements, not specific users

### 3. **Maintainability**
- Centralized role management in `tblUserJobRoles`
- No need to update workflows when employees change

### 4. **Security**
- Users only see workflows relevant to their roles
- Action buttons only appear for current approvers

## Workflow Escalation Integration

The escalation system works seamlessly with role-based workflows:

1. When cutoff date is exceeded:
   - Current approver (role) status remains 'AP'
   - Next approver (role) status changes from 'IN' to 'AP'

2. **All users with these roles can approve:**
   - If role "Supervisor" has 3 users, any of them can approve
   - First to approve wins, others see updated status

3. Email notifications sent to **all users with the pending role**

## Testing the Implementation

### Test User Roles
```sql
-- Check user's roles
SELECT 
  u.emp_int_id,
  u.full_name,
  jr.job_role_id,
  jr.text as role_name
FROM "tblUsers" u
INNER JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
INNER JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
WHERE u.emp_int_id = 'YOUR_EMP_INT_ID';
```

### Test Workflow Steps
```sql
-- Check workflow approval steps
SELECT 
  wfd.wfamsd_id,
  wfd.wfamsh_id,
  wfd.job_role_id,
  jr.text as role_name,
  wfd.sequence,
  wfd.status,
  wfh.asset_id,
  wfh.pl_sch_date
FROM "tblWFAssetMaintSch_D" wfd
INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
WHERE wfd.wfamsh_id = 'WFAMSH_06'
ORDER BY wfd.sequence;
```

### Test Notifications for User
```sql
-- Get notifications for a specific user (same logic as API)
WITH user_roles AS (
  SELECT ujr.job_role_id
  FROM "tblUsers" u
  INNER JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
  WHERE u.emp_int_id = 'YOUR_EMP_INT_ID'
)
SELECT DISTINCT
  wfh.wfamsh_id,
  wfh.asset_id,
  wfh.pl_sch_date,
  wfd.job_role_id,
  jr.text as required_role,
  wfd.status
FROM "tblWFAssetMaintSch_H" wfh
INNER JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
WHERE wfd.job_role_id IN (SELECT job_role_id FROM user_roles)
  AND wfd.status IN ('IN', 'IP', 'AP')
  AND wfh.status IN ('IN', 'IP', 'CO')
ORDER BY wfh.pl_sch_date;
```

## Common Issues and Solutions

### Issue 1: User sees no notifications
**Cause:** User has no roles assigned in `tblUserJobRoles`

**Solution:**
```sql
-- Check user's roles
SELECT * FROM "tblUserJobRoles" ujr
INNER JOIN "tblUsers" u ON ujr.user_id = u.user_id
WHERE u.emp_int_id = 'YOUR_EMP_INT_ID';

-- Assign a role if missing
INSERT INTO "tblUserJobRoles" (user_id, job_role_id, org_id)
VALUES ('USER_ID', 'JOB_ROLE_ID', 'ORG001');
```

### Issue 2: Workflow has no job_role_id
**Cause:** Old workflows might have `user_id` instead of `job_role_id`

**Solution:** Update workflows to use roles:
```sql
UPDATE "tblWFAssetMaintSch_D"
SET job_role_id = 'APPROPRIATE_ROLE_ID'
WHERE user_id IS NOT NULL AND job_role_id IS NULL;
```

### Issue 3: Action buttons not showing
**Cause:** Frontend checks if current user has the required role

**Frontend Logic:**
```javascript
// Check if current user can approve
const currentSteps = steps.filter(step => step.status === 'pending');
const userRoles = user.roles || []; // User's job_role_ids
const isCurrentApprover = currentSteps.some(step => 
  userRoles.includes(step.roleId)
);
```

**Solution:** Ensure user data includes role information

## Summary

✅ **The system is already fully role-based!**

- Backend accepts `emp_int_id` for convenience
- Internally converts to `job_role_id` for querying
- All queries use `job_role_id` from workflow tables
- Multiple users can share roles and approve
- Frontend works seamlessly with this approach

**No changes needed** - the implementation is correct and follows best practices for role-based access control (RBAC).

## Related Files

### Backend
- `models/approvalDetailModel.js` - Main approval logic
- `models/notificationModel.js` - Notification queries
- `models/workflowEscalationModel.js` - Escalation logic
- `controllers/notificationController.js` - Notification endpoints
- `controllers/approvalDetailController.js` - Approval endpoints

### Frontend
- `components/dashboardModules/NotificationsPanel.jsx`
- `components/AllNotifications.jsx`
- `pages/MaintenanceApproval.jsx`
- `components/MaintenanceApprovalDetail.jsx`

