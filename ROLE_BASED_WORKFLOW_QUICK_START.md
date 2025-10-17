# Role-Based Workflow Quick Start Guide

## What Changed?

✅ **Before:** Workflows assigned to specific users (e.g., John Smith)  
✅ **After:** Workflows assigned to roles (e.g., Procurement Manager)

## Key Benefits

1. 🎯 **Any user with the role can approve** - No more bottlenecks waiting for one person
2. 📧 **All role members get notifications** - Better coverage and visibility
3. 📊 **Full audit trail** - System tracks who actually approved
4. 🔄 **Automatic updates** - Add/remove users from roles without touching workflows

## How It Works

### For Administrators

#### 1. Assign Users to Roles
```sql
-- Example: Make all 4 procurement staff "Procurement Managers"
INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
VALUES 
  ('UJROLE_001', 'USER_001', 'JR003'),
  ('UJROLE_002', 'USER_002', 'JR003'),
  ('UJROLE_003', 'USER_003', 'JR003'),
  ('UJROLE_004', 'USER_004', 'JR003');
```

#### 2. Configure Workflow Steps
Workflow steps in `tblWFJobRole` should specify:
- `job_role_id`: The role that can approve (e.g., 'JR003' for Procurement Manager)
- ~~`emp_int_id`~~: **No longer used** (leave as NULL or any placeholder)

The system will automatically:
- Find all users with that `job_role_id`
- Send notifications to all of them
- Allow any of them to approve

### For End Users

#### Receiving Notifications

When a workflow requires your role's approval:
1. 📧 **Email notification** sent to all users with that role
2. 🔔 **In-app notification** appears in your dashboard
3. 👥 **Multiple people receive same notification** - this is expected!

#### Approving Workflows

1. Log in to the system
2. Go to **Maintenance Approval** section
3. You'll see all workflows requiring your role's approval
4. Click **Approve** or **Reject**
5. Add optional notes
6. Submit

**Note:** Only the first person to approve will move the workflow forward. Others will see it's already approved.

### Example Scenario

**Scenario:** Laptop needs maintenance approval

**Workflow Configuration:**
- Step 1: IT Manager approval
- Step 2: Procurement Manager approval
- Step 3: Finance Manager approval

**Process:**

1. **System creates workflow**
   - Step 1 assigned to role: IT Manager (JR001)
   - No specific user assigned

2. **Notifications sent**
   - Email to: Alice (IT Manager)
   - Email to: Bob (IT Manager)
   - Email to: Carol (IT Manager)

3. **Any IT Manager can approve**
   - Bob approves the workflow
   - System records: "Approved by Bob" in history

4. **Workflow moves to Step 2**
   - Email to all Procurement Managers
   - Any one can approve

5. **Continue until complete**
   - Each step notifies all role members
   - Any member can take action
   - History tracks who actually approved

## Email Notification Example

```
Subject: 🔔 Workflow Approval Required - Laptop Maintenance

Hello John,

A workflow requires approval from your role: Procurement Manager

Asset Type: Laptop
Maintenance Type: Preventive Maintenance
Due Date: November 1, 2025
Days Until Due: 15 days

Note: Any Procurement Manager can approve this workflow. 
The first person to approve will move the workflow forward.

[View & Approve Button]
```

## Checking Workflow Status

### As an Approver

**Pending Workflows:**
- Shows: "Action pending by any [Role Name]"
- Button: "Approve" / "Reject" (if you have the role)

**Completed Workflows:**
- Shows: "Approved by [Specific User Name]"
- Displays who actually took action

### As an Administrator

Query history table to see detailed audit trail:

```sql
SELECT 
  wh.wfamhis_id,
  wh.action_by,
  wh.action,
  wh.action_on,
  u.full_name,
  jr.text as job_role_name
FROM "tblWFAssetMaintHist" wh
LEFT JOIN "tblUsers" u ON wh.action_by = u.emp_int_id
LEFT JOIN "tblWFAssetMaintSch_D" wfd ON wh.wfamsd_id = wfd.wfamsd_id
LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
WHERE wh.wfamsh_id = 'WFAMSH_001'
ORDER BY wh.action_on;
```

## Common Questions

### Q: What if multiple people try to approve at the same time?

**A:** The first person to submit their approval wins. The system will show others that it's already approved. This is by design and prevents conflicts.

### Q: Can I still see who approved even though multiple people were notified?

**A:** Yes! The system records the specific user who approved in:
- `tblWFAssetMaintHist.action_by` - Full audit trail (PRIMARY SOURCE)
- `tblWFAssetMaintSch_D.user_id` - NOT USED (always NULL)

**To see who approved, query the history table:**
```sql
SELECT u.full_name, wh.action, wh.action_on
FROM "tblWFAssetMaintHist" wh
JOIN "tblUsers" u ON wh.action_by = u.emp_int_id
WHERE wh.wfamsh_id = 'your_workflow_id'
```

### Q: What if I have multiple roles?

**A:** You'll receive notifications for any workflow that requires any of your roles. You can approve workflows for any role you belong to.

### Q: Can I approve on behalf of someone else with my role?

**A:** Yes, that's the whole point! If you have the role, you can approve, regardless of whether other people with the same role have been notified.

### Q: What happens to old workflows that were assigned to specific users?

**A:** 
- **Option 1:** They continue to work as before (backwards compatible)
- **Option 2:** Run migration script to convert them to role-based
- All **new workflows** are automatically role-based

## Setup Verification

### 1. Verify User Role Assignments

```sql
-- Check which roles a user has
SELECT u.emp_int_id, u.full_name, jr.job_role_id, jr.text as role_name
FROM "tblUsers" u
INNER JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
INNER JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
WHERE u.emp_int_id = 'EMP_INT_001';
```

### 2. Verify Workflow Configuration

```sql
-- Check workflow steps for an asset type
SELECT 
  wfr.wf_job_role_id,
  wfr.job_role_id,
  jr.text as role_name,
  wfs.wf_steps_id,
  wfas.seqs_no as sequence
FROM "tblWFJobRole" wfr
INNER JOIN "tblJobRoles" jr ON wfr.job_role_id = jr.job_role_id
INNER JOIN "tblWFSteps" wfs ON wfr.wf_steps_id = wfs.wf_steps_id
INNER JOIN "tblWFATSeqs" wfas ON wfs.wf_steps_id = wfas.wf_steps_id
WHERE wfas.asset_type_id = 'AT001'
ORDER BY wfas.seqs_no;
```

### 3. Test Notification Sending

```javascript
// Test sending notifications to a role
const { sendWorkflowNotificationToRole } = require('./utils/mailer');

await sendWorkflowNotificationToRole({
  assetTypeName: 'Test Asset',
  maintenanceType: 'Test Maintenance',
  dueDate: '2025-11-01',
  daysUntilDue: 15,
  isUrgent: false
}, 'JR003', 'ORG001');
```

## Troubleshooting

### User Not Receiving Notifications

1. ✅ Check user has role in `tblUserJobRoles`
2. ✅ Verify user email is valid in `tblUsers`
3. ✅ Check user `int_status = 1` (active)
4. ✅ Verify email configuration in `.env`

### User Cannot Approve

1. ✅ Verify user has the required role
2. ✅ Check workflow step status is 'AP'
3. ✅ Ensure `job_role_id` matches user's role

### Workflow Not Moving Forward

1. ✅ Check if workflow step was approved
2. ✅ Verify next step exists in sequence
3. ✅ Check workflow header status

## Best Practices

1. **📋 Assign Multiple Users to Critical Roles**
   - Ensures coverage when someone is unavailable
   - Typical: 2-5 users per approval role

2. **⏰ Set Reasonable Lead Times**
   - Give enough time for any role member to approve
   - Consider time zones and work schedules

3. **📧 Monitor Email Deliverability**
   - Regularly check email logs
   - Ensure users whitelist system emails

4. **🔍 Review Approval Patterns**
   - Track which users approve most frequently
   - Balance workload across role members

5. **📊 Maintain Role Assignments**
   - Update when staff changes roles
   - Remove users from roles when they leave

## Support

For issues or questions:
1. Check this guide first
2. Review `ROLE_BASED_WORKFLOW_IMPLEMENTATION.md` for technical details
3. Contact system administrator

---

**Quick Reference:**
- ✅ Role-based: Anyone with role can approve
- ✅ All notified: Everyone with role gets email
- ✅ First wins: First approval moves workflow
- ✅ Full audit: System tracks who approved
- ✅ No bottlenecks: Multiple people can handle approvals

