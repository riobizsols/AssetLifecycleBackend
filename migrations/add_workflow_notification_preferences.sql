-- Migration: Add workflow notification preferences
-- This migration adds default notification preferences for workflow-related notifications

-- Insert default notification preferences for workflow_approval
INSERT INTO "tblNotificationPreferences" (
    preference_id, 
    user_id, 
    notification_type, 
    is_enabled, 
    email_enabled, 
    push_enabled,
    created_on,
    updated_on
)
SELECT 
    'PREF_WF_APPROVAL_' || u.user_id,
    u.user_id,
    'workflow_approval',
    true,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "tblUsers" u
WHERE u.int_status = 1
  AND NOT EXISTS (
    SELECT 1 FROM "tblNotificationPreferences" np 
    WHERE np.user_id = u.user_id 
      AND np.notification_type = 'workflow_approval'
  );

-- Insert default notification preferences for breakdown_approval
INSERT INTO "tblNotificationPreferences" (
    preference_id, 
    user_id, 
    notification_type, 
    is_enabled, 
    email_enabled, 
    push_enabled,
    created_on,
    updated_on
)
SELECT 
    'PREF_BD_APPROVAL_' || u.user_id,
    u.user_id,
    'breakdown_approval',
    true,
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "tblUsers" u
WHERE u.int_status = 1
  AND NOT EXISTS (
    SELECT 1 FROM "tblNotificationPreferences" np 
    WHERE np.user_id = u.user_id 
      AND np.notification_type = 'breakdown_approval'
  );

-- Create index for better performance on notification preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_type 
ON "tblNotificationPreferences" (user_id, notification_type);

-- Create index for better performance on FCM tokens
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_active 
ON "tblFCMTokens" (user_id, is_active);

-- Create index for better performance on notification history
CREATE INDEX IF NOT EXISTS idx_notification_history_user_type 
ON "tblNotificationHistory" (user_id, notification_type);

-- Add comments for documentation
COMMENT ON TABLE "tblNotificationPreferences" IS 'User notification preferences for different notification types';
COMMENT ON COLUMN "tblNotificationPreferences".notification_type IS 'Type of notification: workflow_approval, breakdown_approval, asset_created, etc.';
COMMENT ON COLUMN "tblNotificationPreferences".push_enabled IS 'Whether push notifications are enabled for this user and notification type';
COMMENT ON COLUMN "tblNotificationPreferences".email_enabled IS 'Whether email notifications are enabled for this user and notification type';
