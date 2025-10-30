# 📱 Workflow Push Notification System Implementation

## 🎯 Overview

This implementation adds push notification functionality to the Asset Lifecycle Management system. When new records are added to `tblWFAssetMaintSch_D` (workflow maintenance schedule details), users with the appropriate job roles receive push notifications on their mobile devices.

## 🏗️ Architecture

### Components Added

1. **WorkflowNotificationService** (`services/workflowNotificationService.js`)
   - Handles notification logic for workflow details
   - Differentiates between regular and breakdown notifications
   - Integrates with existing FCM service

2. **Modified MaintenanceScheduleModel** (`models/maintenanceScheduleModel.js`)
   - Updated `insertWorkflowMaintenanceScheduleDetail` function
   - Automatically triggers notifications when new records are inserted

3. **Database Migration** (`migrations/add_workflow_notification_preferences.sql`)
   - Adds default notification preferences for all users
   - Creates performance indexes
   - Adds documentation comments

4. **Test Script** (`test_workflow_notifications.js`)
   - Comprehensive testing of the notification system
   - Validates all components are working correctly

## 🔄 How It Works

### 1. Workflow Detail Creation

When a new workflow maintenance schedule detail is created:

```javascript
// In maintenanceScheduleController.js or reportbreakdownModel.js
await model.insertWorkflowMaintenanceScheduleDetail(scheduleDetailData);
```

### 2. Automatic Notification Trigger

The `insertWorkflowMaintenanceScheduleDetail` function now:

1. **Inserts the record** into `tblWFAssetMaintSch_D`
2. **Checks the status** - only sends notifications for status 'AP' (Approval Pending)
3. **Determines notification type** based on notes:
   - Breakdown notifications (contains 'BF01-Breakdown', 'BF03-Breakdown', or 'breakdown')
   - Regular workflow notifications
4. **Sends push notification** to all users with the required job role

### 3. Notification Flow

```
New Record in tblWFAssetMaintSch_D
    ↓
Status = 'AP'? → Yes
    ↓
Get Job Role ID
    ↓
Find All Users with This Job Role
    ↓
Send Push Notification to Each User
    ↓
Log Notification History
```

## 📋 Notification Types

### 1. Regular Workflow Notifications
- **Type**: `workflow_approval`
- **Title**: "New Maintenance Approval Required"
- **Body**: "Asset '{asset_name}' requires maintenance approval. Please review and approve."
- **Trigger**: When status = 'AP' and no breakdown keywords in notes

### 2. Breakdown Notifications
- **Type**: `breakdown_approval`
- **Title**: "Urgent: Asset Breakdown Approval Required"
- **Body**: "Asset '{asset_name}' has reported a breakdown and requires urgent maintenance approval."
- **Trigger**: When status = 'AP' and notes contain breakdown keywords

## 🎯 Target Users

The system uses **role-based notifications**:

- **Job Role Assignment**: Users are assigned to job roles via `tblUserJobRoles`
- **Workflow Assignment**: Workflow details specify `job_role_id` (not specific users)
- **Notification Delivery**: All users with the required job role receive notifications
- **Approval Flexibility**: Any user with the role can approve (first person wins)

## 🔧 Configuration

### 1. Notification Preferences

Each user has preferences for each notification type:

```sql
-- Default preferences are created for all users
INSERT INTO "tblNotificationPreferences" (
    user_id, notification_type, is_enabled, 
    email_enabled, push_enabled
) VALUES (
    'USER_001', 'workflow_approval', true, true, true
);
```

### 2. FCM Device Tokens

Users must register their device tokens:

```javascript
// Mobile app registers token
POST /api/fcm/register-token
{
    "deviceToken": "fcm_device_token_here",
    "platform": "ios",
    "deviceType": "mobile"
}
```

### 3. Firebase Configuration

Environment variables required:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
```

## 🧪 Testing

### Run the Test Script

```bash
cd AssetLifecycleBackend
node test_workflow_notifications.js
```

### Test Results

The test script validates:
- ✅ FCM Service initialization
- ✅ Users with job roles
- ✅ Available assets
- ✅ Notification preferences
- ✅ FCM device tokens
- ✅ Notification sending (simulated if Firebase not configured)

### Manual Testing

1. **Create a workflow** that requires approval
2. **Check console logs** for notification attempts
3. **Verify mobile app** receives push notification
4. **Check notification history** in database

## 📊 Database Tables

### tblWFAssetMaintSch_D (Workflow Details)
- **job_role_id**: Determines which role can approve
- **status**: 'AP' triggers notifications
- **notes**: Contains breakdown information for context

### tblUserJobRoles (User-Role Mapping)
- Links users to their job roles
- Multiple users can have the same role

### tblNotificationPreferences (User Preferences)
- Controls which notifications each user receives
- Separate settings for email and push notifications

### tblFCMTokens (Device Tokens)
- Stores mobile device tokens for push notifications
- Automatically cleaned up for invalid tokens

### tblNotificationHistory (Delivery Log)
- Logs all notification attempts
- Tracks success/failure rates
- Provides audit trail

## 🚀 Deployment

### 1. Run Database Migration

```bash
psql -d your_database -f migrations/add_workflow_notification_preferences.sql
```

### 2. Configure Environment Variables

Add Firebase credentials to your environment configuration.

### 3. Test the System

```bash
node test_workflow_notifications.js
```

### 4. Mobile App Integration

Ensure your mobile app:
- Registers FCM tokens on startup
- Handles incoming notifications
- Updates notification preferences

## 🔍 Monitoring

### Console Logs

The system logs all notification attempts:

```
Push notification triggered for workflow detail WFAMSD_001
Workflow notification sent for wfamsd_id WFAMSD_001: {
  jobRoleId: 'JR004',
  jobRoleName: 'Safety Officer',
  assetName: 'Fire Extinguisher A',
  totalUsers: 3,
  successCount: 2,
  failureCount: 1
}
```

### Database Queries

Check notification history:

```sql
SELECT 
    nh.notification_type,
    nh.title,
    nh.status,
    nh.sent_on,
    u.first_name,
    u.last_name
FROM "tblNotificationHistory" nh
INNER JOIN "tblUsers" u ON nh.user_id = u.user_id
WHERE nh.notification_type IN ('workflow_approval', 'breakdown_approval')
ORDER BY nh.sent_on DESC
LIMIT 10;
```

## 🛠️ Troubleshooting

### Common Issues

1. **No notifications sent**
   - Check if users have device tokens registered
   - Verify notification preferences are enabled
   - Check Firebase configuration

2. **Notifications sent but not received**
   - Verify FCM tokens are valid
   - Check mobile app notification handling
   - Verify device has internet connection

3. **Wrong users receiving notifications**
   - Check job role assignments in `tblUserJobRoles`
   - Verify workflow detail has correct `job_role_id`

### Debug Commands

```sql
-- Check users with specific job role
SELECT u.first_name, u.last_name, jr.text as role_name
FROM "tblUsers" u
INNER JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
INNER JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
WHERE jr.job_role_id = 'JR004';

-- Check notification preferences
SELECT u.first_name, np.notification_type, np.push_enabled
FROM "tblUsers" u
INNER JOIN "tblNotificationPreferences" np ON u.user_id = np.user_id
WHERE np.notification_type = 'workflow_approval';

-- Check FCM tokens
SELECT u.first_name, ft.platform, ft.is_active
FROM "tblUsers" u
INNER JOIN "tblFCMTokens" ft ON u.user_id = ft.user_id
WHERE ft.is_active = true;
```

## 📈 Performance Considerations

### Indexes Added

- `idx_notification_preferences_user_type`: Fast preference lookups
- `idx_fcm_tokens_user_active`: Fast token retrieval
- `idx_notification_history_user_type`: Fast history queries

### Optimization

- Notifications are sent asynchronously (don't block main operations)
- Failed notifications are logged but don't fail the workflow
- Invalid FCM tokens are automatically cleaned up
- Bulk notification sending for multiple users

## 🔒 Security

### Token Management

- FCM tokens are stored securely in database
- Invalid tokens are automatically deactivated
- User preferences control notification delivery

### Access Control

- Only authenticated users can register tokens
- Notifications respect user preferences
- Role-based access ensures proper targeting

## 📝 Future Enhancements

### Potential Improvements

1. **Notification Scheduling**: Send notifications at optimal times
2. **Notification Templates**: Customizable notification content
3. **Escalation**: Send reminders for pending approvals
4. **Analytics**: Track notification engagement rates
5. **Batch Notifications**: Group multiple notifications together

### API Extensions

```javascript
// Future API endpoints
GET /api/notifications/workflow/pending/:emp_int_id
POST /api/notifications/workflow/mark-read/:notification_id
GET /api/notifications/workflow/history/:emp_int_id
```

---

## ✅ Implementation Complete

The workflow push notification system is now fully implemented and ready for use. Users with appropriate job roles will receive push notifications whenever new maintenance approval workflows are created, ensuring timely response to maintenance requests.
