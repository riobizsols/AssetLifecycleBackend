# Role-Based Workflow Implementation

## Overview

The workflow notification and approval system has been converted from **user-specific** to **role-based**. This means that instead of assigning workflow approvals to specific individual users, approvals are now assigned to job roles. All users with that role receive notifications and any one of them can approve the workflow.

## Key Changes

### 1. **Workflow Detail Creation** (`maintenanceScheduleController.js`)

**Before:** 
```javascript
user_id: jobRole.emp_int_id  // Specific user assigned
```

**After:**
```javascript
user_id: null,  // No specific user - role-based
job_role_id: jobRole.job_role_id  // Only role is stored
```

- Workflows no longer store a specific `user_id` in `tblWFAssetMaintSch_D`
- Only `job_role_id` is stored when creating workflow steps
- This allows all users with that role to be notified and take action

### 2. **Notification Queries** (`notificationModel.js`)

**Changes:**
- `getMaintenanceNotifications()`: Now joins with `tblUserJobRoles` and `tblUsers` to fetch all users with the required role
- `getMaintenanceNotificationsByUser()`: Checks if user has any of the required job roles using role membership
- Returns multiple rows (one per user) for each workflow step that requires action

### 3. **Approval & Rejection Logic** (`approvalDetailModel.js`)

**Key Enhancements:**

#### `approveMaintenance()`
1. Fetches user's roles from `tblUserJobRoles`
2. Checks if user has any of the required roles for the workflow
3. Finds workflow steps with status 'AP' (Approval Pending) where user's role matches
4. Updates the workflow step status to 'UA' (User Approved)
5. **Records the actual user who approved** by setting `user_id` and storing `action_by` in `tblWFAssetMaintHist`

#### `rejectMaintenance()`
1. Similar role-based checking as approval
2. Updates workflow step status to 'UR' (User Rejected)
3. **Records the actual user who rejected** in history table

### 4. **Display Queries** (`approvalDetailModel.js`)

**Updated Functions:**
- `getApprovalDetailByAssetId()`: Shows role name instead of specific user for pending steps
- `getMaintenanceApprovals()`: Fetches workflows based on user's role membership
- Dynamically displays who approved/rejected once action is taken

**Display Logic:**
```javascript
// Always shows role name (user_id is never used)
switch (status) {
  case 'AP':
    description = `Action pending by any ${detail.job_role_name}`;
    break;
  case 'UA':
    description = `Approved by ${detail.job_role_name}`;
    break;
  case 'UR':
    description = `Rejected by ${detail.job_role_name}`;
    break;
  case 'IN':
    description = `Waiting for approval from any ${detail.job_role_name}`;
    break;
}

// To see WHO specifically approved, query tblWFAssetMaintHist:
// SELECT action_by, u.full_name 
// FROM tblWFAssetMaintHist wh
// JOIN tblUsers u ON wh.action_by = u.emp_int_id
```

### 5. **Email Notification Service** (`services/emailService.js`)

**New Function:** `sendWorkflowNotificationToRole()`

- Queries all users with a specific `job_role_id` from `tblUserJobRoles`
- Sends email notifications to all users with that role
- Email includes:
  - Workflow details (asset type, maintenance type, due date)
  - Urgency indicators
  - Clear message that **any user with the role can approve**
  - Direct link to approval page

**Usage:**
```javascript
const { sendWorkflowNotificationToRole } = require('./utils/mailer');

await sendWorkflowNotificationToRole({
  assetTypeName: 'Laptop',
  maintenanceType: 'Preventive Maintenance',
  dueDate: '2025-11-01',
  daysUntilDue: 15,
  isUrgent: false
}, 'JR003', 'ORG001');
```

## Database Schema Impact

### `tblWFAssetMaintSch_D` (Workflow Schedule Detail)

**Fields:**
- `wfamsd_id` - Primary key
- `wfamsh_id` - Foreign key to header
- `job_role_id` - **Required**: The role that can approve this step
- `user_id` - **NOT USED**: Always NULL (role-based, not user-specific)
- `dept_id` - Department
- `sequence` - Step order
- `status` - Workflow step status (IN, AP, UA, UR)
- `notes` - Notes from approver/rejecter
- `org_id` - Organization

**Important:** The `user_id` field is intentionally left NULL. We only use `job_role_id` for role-based approvals.

### `tblWFAssetMaintHist` (Workflow History)

**Fields:**
- `wfamhis_id` - Primary key
- `wfamsh_id` - Foreign key to workflow header
- `wfamsd_id` - Foreign key to workflow detail
- `action_by` - **Stores actual user (emp_int_id) who took action**
- `action_on` - Timestamp of action
- `action` - Action type (UA, UR, AP, etc.)
- `notes` - Action notes
- `org_id` - Organization

**Important:** The `action_by` field in `tblWFAssetMaintHist` is the authoritative record of who actually approved or rejected a workflow step.

### `tblUserJobRoles` (User to Job Role Mapping)

**Fields:**
- `user_job_role_id` - Primary key
- `user_id` - Foreign key to users
- `job_role_id` - Foreign key to job roles

**Purpose:** Links users to their assigned roles. This is the lookup table for role-based permissions.

## Workflow Flow

### Before (User-Specific):
1. Workflow created → Specific user assigned to step
2. Only that user receives notification
3. Only that user can approve
4. Workflow moves to next specific user

### After (Role-Based):
1. Workflow created → Role assigned to step (no specific user)
2. **All users with that role receive notification**
3. **Any user with that role can approve**
4. Once approved, user who approved is recorded
5. Workflow moves to next role
6. **All users with next role receive notification**

## Benefits

1. **Flexibility**: If a user is unavailable, any other user with the same role can approve
2. **Scalability**: Easy to add/remove users from roles without updating workflows
3. **Load Balancing**: Multiple people can handle approvals, reducing bottlenecks
4. **Transparency**: History table records exactly who took action
5. **Coverage**: No workflows get stuck waiting for a specific person who might be absent

## Example Scenario

### Procurement Approval Workflow

**Setup:**
- Role: Procurement Manager (JR003)
- Users with role:
  - User A (EMP_INT_001)
  - User B (EMP_INT_002)
  - User C (EMP_INT_003)
  - User D (EMP_INT_004)

**Workflow Process:**
1. Maintenance workflow initiated for a laptop
2. Step 1 requires approval from Procurement Manager (JR003)
3. **All 4 users (A, B, C, D) receive email notification**
4. User B logs in and approves the workflow
5. System records:
   - `tblWFAssetMaintSch_D.user_id` = NULL (NOT USED - remains NULL)
   - `tblWFAssetMaintHist.action_by` = 'EMP_INT_002' (User B) ✅ TRACKED HERE
6. Workflow moves to next step
7. Other users (A, C, D) see that workflow is already approved

## Testing Checklist

- [ ] Create workflow - verify `user_id` is NULL, `job_role_id` is set
- [ ] Verify all users with role receive notifications
- [ ] Test approval by any user with the role
- [ ] Verify `user_id` REMAINS NULL after approval
- [ ] Verify `action_by` in history records correct user
- [ ] Test rejection by any user with the role
- [ ] Verify only users with correct role can approve
- [ ] Test with multiple users having same role
- [ ] Verify email notifications are sent to all role members
- [ ] Test workflow with users having multiple roles
- [ ] Verify workflow display shows role name (not specific user)
- [ ] Query history table to see who actually approved

## Files Modified

1. **`controllers/maintenanceScheduleController.js`** - Workflow creation logic
2. **`models/notificationModel.js`** - Notification queries
3. **`models/approvalDetailModel.js`** - Approval/rejection logic and display queries
4. **`services/emailService.js`** - Role-based email notifications
5. **`utils/mailer.js`** - Export new email function

## Migration Notes

### For Existing Workflows

If you have existing workflows with specific users assigned:

1. **Option 1: Let them complete naturally** - Existing workflows will continue to work with specific users
2. **Option 2: Migrate existing workflows** - Run a migration script to:
   - Update `user_id` to NULL for pending workflows
   - Ensure `job_role_id` is properly set
   
**Migration Script Example:**
```sql
-- Update pending workflow steps to be role-based
UPDATE "tblWFAssetMaintSch_D" wfd
SET user_id = NULL
WHERE wfd.status IN ('IN', 'AP')
  AND wfd.user_id IS NOT NULL
  AND wfd.job_role_id IS NOT NULL;
```

### For New Workflows

All new workflows created after this implementation will automatically be role-based.

## API Integration

### Frontend Changes Required

1. **Approval Display**: Update UI to show "Pending approval from [Role Name]" instead of specific user
2. **Notification Lists**: Show all workflows where user's role matches
3. **Approval Button**: Show approve button if user has required role
4. **History Display**: Show specific user name in completed/rejected steps

### Backend API Responses

No breaking changes to API structure. Response fields updated:
- `user_name`: Always shows role name (since `user_id` is always NULL)
- `job_role_name`: Role information for the workflow step
- `action_by`: In history table, shows who actually took action

**To get approver name:** Query `tblWFAssetMaintHist` joined with `tblUsers`

## Troubleshooting

### Issue: User not seeing workflows
**Solution:** 
1. Check if user has role assigned in `tblUserJobRoles`
2. Verify workflow step has correct `job_role_id`
3. Check user's `int_status` is 1 (active)

### Issue: User cannot approve
**Solution:**
1. Verify user has the required role
2. Check workflow step status is 'AP' (Approval Pending)
3. Ensure user's role matches `job_role_id` of workflow step

### Issue: Notifications not sent
**Solution:**
1. Check email configuration in `.env`
2. Verify users have valid email addresses
3. Check `tblUserJobRoles` for role assignments
4. Review email service logs

## Future Enhancements

1. **Notification Preferences**: Allow users to configure notification settings
2. **Role Hierarchies**: Implement automatic escalation if no one with role approves within timeframe
3. **Approval Quotas**: Require multiple approvals from same role (e.g., 2 out of 4 procurement managers)
4. **Delegation**: Allow users to delegate their role temporarily
5. **Mobile Notifications**: Push notifications for workflow approvals

## Support

For questions or issues related to role-based workflow implementation, contact the development team.

---

**Implementation Date:** October 17, 2025  
**Version:** 1.0  
**Status:** ✅ Complete

