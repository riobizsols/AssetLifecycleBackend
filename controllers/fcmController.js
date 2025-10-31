const fcmService = require('../services/fcmService');
const {
    logDeviceTokenRegistered,
    logDeviceTokenUpdated,
    logDeviceTokenUnregistered,
    logNotificationPreferencesUpdated,
    logNotificationPreferencesRetrieved,
    logFcmOperationError
} = require('../eventLoggers/fcmEventLogger');

class FCMController {
    /**
     * Register device token for push notifications
     */
    async registerDeviceToken(req, res) {
        const startTime = Date.now();
        const userId = req.user?.user_id;

        try {
            const { deviceToken, deviceType, platform, appVersion, deviceInfo } = req.body;

            // Validation
            if (!deviceToken) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Device token is required' 
                });
            }

            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'User authentication required' 
                });
            }

            // Register token
            const result = await fcmService.registerDeviceToken({
                userId,
                deviceToken,
                deviceType,
                platform,
                appVersion,
                deviceInfo
            });

            const duration = Date.now() - startTime;

            // Log event
            if (result.isUpdate) {
                await logDeviceTokenUpdated({
                    userId,
                    deviceToken,
                    deviceType,
                    platform,
                    duration
                });
            } else {
                await logDeviceTokenRegistered({
                    userId,
                    deviceToken,
                    deviceType,
                    platform,
                    duration
                });
            }

            res.json({
                success: true,
                message: result.isUpdate ? 'Device token updated successfully' : 'Device token registered successfully',
                data: {
                    tokenId: result.token.token_id,
                    isUpdate: result.isUpdate
                }
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            await logFcmOperationError({
                operation: 'Device Token Registration',
                error,
                requestData: { userId, deviceToken: req.body.deviceToken },
                duration,
                userId
            });

            console.error('Error registering device token:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to register device token',
                error: error.message
            });
        }
    }

    /**
     * Unregister device token
     */
    async unregisterDeviceToken(req, res) {
        const startTime = Date.now();
        const userId = req.user?.user_id;

        try {
            const { deviceToken } = req.body;

            // Validation
            if (!deviceToken) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Device token is required' 
                });
            }

            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'User authentication required' 
                });
            }

            // Unregister token
            const result = await fcmService.unregisterDeviceToken(userId, deviceToken);

            const duration = Date.now() - startTime;

            // Log event
            await logDeviceTokenUnregistered({
                userId,
                deviceToken,
                duration
            });

            res.json({
                success: true,
                message: 'Device token unregistered successfully',
                data: {
                    affectedRows: result.affectedRows
                }
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            await logFcmOperationError({
                operation: 'Device Token Unregistration',
                error,
                requestData: { userId, deviceToken: req.body.deviceToken },
                duration,
                userId
            });

            console.error('Error unregistering device token:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to unregister device token',
                error: error.message
            });
        }
    }

    /**
     * Get user's device tokens
     */
    async getUserDeviceTokens(req, res) {
        const startTime = Date.now();
        const userId = req.user?.user_id;

        try {
            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'User authentication required' 
                });
            }

            const { platform } = req.query;

            // Get tokens
            const tokens = await fcmService.getUserDeviceTokens(userId, platform);

            const duration = Date.now() - startTime;

            res.json({
                success: true,
                message: 'Device tokens retrieved successfully',
                data: {
                    tokens: tokens.map(token => ({
                        tokenId: token.token_id,
                        deviceType: token.device_type,
                        platform: token.platform,
                        appVersion: token.app_version,
                        isActive: token.is_active,
                        lastUsed: token.last_used,
                        createdOn: token.created_on
                    }))
                }
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            await logFcmOperationError({
                operation: 'Get User Device Tokens',
                error,
                requestData: { userId },
                duration,
                userId
            });

            console.error('Error getting user device tokens:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get device tokens',
                error: error.message
            });
        }
    }

    /**
     * Update notification preferences
     */
    async updateNotificationPreferences(req, res) {
        const startTime = Date.now();
        const userId = req.user?.user_id;

        try {
            const { notificationType, preferences } = req.body;

            // Validation
            if (!notificationType || !preferences) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Notification type and preferences are required' 
                });
            }

            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'User authentication required' 
                });
            }

            // Update preferences
            const result = await fcmService.updateNotificationPreferences(
                userId, 
                notificationType, 
                preferences
            );

            const duration = Date.now() - startTime;

            // Log event
            await logNotificationPreferencesUpdated({
                userId,
                notificationType,
                preferences,
                duration
            });

            res.json({
                success: true,
                message: 'Notification preferences updated successfully',
                data: result.preference
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            await logFcmOperationError({
                operation: 'Update Notification Preferences',
                error,
                requestData: { userId, notificationType: req.body.notificationType },
                duration,
                userId
            });

            console.error('Error updating notification preferences:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update notification preferences',
                error: error.message
            });
        }
    }

    /**
     * Get notification preferences
     */
    async getNotificationPreferences(req, res) {
        const startTime = Date.now();
        const userId = req.user?.user_id;

        try {
            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'User authentication required' 
                });
            }

            // Get preferences
            const preferences = await fcmService.getNotificationPreferences(userId);

            const duration = Date.now() - startTime;

            // Log event
            await logNotificationPreferencesRetrieved({
                userId,
                preferencesCount: preferences.length,
                duration
            });

            res.json({
                success: true,
                message: 'Notification preferences retrieved successfully',
                data: {
                    preferences: preferences.map(pref => ({
                        preferenceId: pref.preference_id,
                        notificationType: pref.notification_type,
                        isEnabled: pref.is_enabled,
                        emailEnabled: pref.email_enabled,
                        pushEnabled: pref.push_enabled,
                        createdOn: pref.created_on,
                        updatedOn: pref.updated_on
                    }))
                }
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            await logFcmOperationError({
                operation: 'Get Notification Preferences',
                error,
                requestData: { userId },
                duration,
                userId
            });

            console.error('Error getting notification preferences:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get notification preferences',
                error: error.message
            });
        }
    }

    /**
     * Send test notification to current user
     */
    async sendTestNotification(req, res) {
        const startTime = Date.now();
        const userId = req.user?.user_id;

        try {
            const { title, body, data } = req.body;

            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'User authentication required' 
                });
            }

            // Send test notification
            const result = await fcmService.sendNotificationToUser({
                userId,
                title: title || 'Test Notification',
                body: body || 'This is a test notification from your Asset Management System',
                data: data || { type: 'test' },
                notificationType: 'test_notification'
            });

            const duration = Date.now() - startTime;

            res.json({
                success: true,
                message: 'Test notification sent successfully',
                data: result
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            await logFcmOperationError({
                operation: 'Send Test Notification',
                error,
                requestData: { userId },
                duration,
                userId
            });

            console.error('Error sending test notification:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send test notification',
                error: error.message
            });
        }
    }
}

module.exports = new FCMController();
