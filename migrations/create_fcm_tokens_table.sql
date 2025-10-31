-- Create FCM tokens table for storing device tokens
CREATE TABLE IF NOT EXISTS "tblFCMTokens" (
    token_id VARCHAR(20) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    device_token TEXT NOT NULL,
    device_type VARCHAR(20) DEFAULT 'mobile', -- 'mobile', 'web', 'desktop'
    platform VARCHAR(20), -- 'ios', 'android', 'web'
    app_version VARCHAR(20),
    device_info JSONB,
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "tblUsers"(user_id) ON DELETE CASCADE
);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS "tblNotificationPreferences" (
    preference_id VARCHAR(20) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'asset_created', 'asset_updated', 'maintenance_due', 'workflow_approval', etc.
    is_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "tblUsers"(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, notification_type)
);

-- Create notification history table
CREATE TABLE IF NOT EXISTS "tblNotificationHistory" (
    notification_id VARCHAR(20) PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    token_id VARCHAR(20),
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    status VARCHAR(20) DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'clicked'
    fcm_response JSONB,
    sent_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_on TIMESTAMP,
    clicked_on TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES "tblUsers"(user_id) ON DELETE CASCADE,
    FOREIGN KEY (token_id) REFERENCES "tblFCMTokens"(token_id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON "tblFCMTokens"(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_active ON "tblFCMTokens"(is_active);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON "tblNotificationPreferences"(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type ON "tblNotificationPreferences"(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON "tblNotificationHistory"(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON "tblNotificationHistory"(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_on ON "tblNotificationHistory"(sent_on);

-- Insert default notification preferences for existing users
INSERT INTO "tblNotificationPreferences" (preference_id, user_id, notification_type, is_enabled, email_enabled, push_enabled)
SELECT 
    'NP' || LPAD(ROW_NUMBER() OVER()::TEXT, 3, '0'),
    u.user_id,
    nt.notification_type,
    true,
    true,
    true
FROM "tblUsers" u
CROSS JOIN (
    VALUES 
        ('asset_created'),
        ('asset_updated'),
        ('asset_deleted'),
        ('maintenance_due'),
        ('maintenance_completed'),
        ('workflow_approval'),
        ('workflow_escalated'),
        ('breakdown_reported'),
        ('user_assigned')
) AS nt(notification_type)
WHERE u.int_status = 1
ON CONFLICT (user_id, notification_type) DO NOTHING;

-- Create trigger to update updated_on timestamp
CREATE OR REPLACE FUNCTION update_updated_on_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_on = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fcm_tokens_updated_on BEFORE UPDATE ON "tblFCMTokens"
    FOR EACH ROW EXECUTE FUNCTION update_updated_on_column();

CREATE TRIGGER update_notification_preferences_updated_on BEFORE UPDATE ON "tblNotificationPreferences"
    FOR EACH ROW EXECUTE FUNCTION update_updated_on_column();
