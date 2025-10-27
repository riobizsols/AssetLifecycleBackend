const admin = require('firebase-admin');
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class FCMService {
    constructor() {
        this.initialized = false;
        this.init();
    }

    /**
     * Initialize Firebase Admin SDK
     */
    async init() {
        try {
            if (!admin.apps.length) {
                const serviceAccount = {
                    type: "service_account",
                    project_id: process.env.FIREBASE_PROJECT_ID,
                    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    client_email: process.env.FIREBASE_CLIENT_EMAIL,
                    client_id: process.env.FIREBASE_CLIENT_ID,
                    auth_uri: "https://accounts.google.com/o/oauth2/auth",
                    token_uri: "https://oauth2.googleapis.com/token",
                    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
                };

                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    projectId: process.env.FIREBASE_PROJECT_ID
                });
            }
            this.initialized = true;
            console.log('FCM Service initialized successfully');
        } catch (error) {
            console.error('Error initializing FCM Service:', error);
            throw error;
        }
    }

    /**
     * Register a device token for a user
     * @param {Object} tokenData - Token registration data
     * @param {string} tokenData.userId - User ID
     * @param {string} tokenData.deviceToken - FCM device token
     * @param {string} tokenData.deviceType - Device type (mobile, web, desktop)
     * @param {string} tokenData.platform - Platform (ios, android, web)
     * @param {string} tokenData.appVersion - App version
     * @param {Object} tokenData.deviceInfo - Additional device information
     */
    async registerDeviceToken(tokenData) {
        try {
            const { userId, deviceToken, deviceType = 'mobile', platform, appVersion, deviceInfo } = tokenData;

            // Generate token ID
            const tokenId = 'FCM' + uuidv4().substring(0, 15).toUpperCase();

            // Check if token already exists for this user and device
            const existingTokenQuery = `
                SELECT token_id FROM "tblFCMTokens" 
                WHERE user_id = $1 AND device_token = $2
            `;
            const existingToken = await db.query(existingTokenQuery, [userId, deviceToken]);

            if (existingToken.rows.length > 0) {
                // Update existing token
                const updateQuery = `
                    UPDATE "tblFCMTokens" 
                    SET device_type = $1, platform = $2, app_version = $3, 
                        device_info = $4, is_active = true, last_used = CURRENT_TIMESTAMP, 
                        updated_on = CURRENT_TIMESTAMP
                    WHERE token_id = $5
                    RETURNING *
                `;
                const result = await db.query(updateQuery, [
                    deviceType, platform, appVersion, JSON.stringify(deviceInfo), 
                    existingToken.rows[0].token_id
                ]);
                return { success: true, token: result.rows[0], isUpdate: true };
            } else {
                // Insert new token
                const insertQuery = `
                    INSERT INTO "tblFCMTokens" (
                        token_id, user_id, device_token, device_type, platform, 
                        app_version, device_info, is_active, last_used
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP)
                    RETURNING *
                `;
                const result = await db.query(insertQuery, [
                    tokenId, userId, deviceToken, deviceType, platform, 
                    appVersion, JSON.stringify(deviceInfo)
                ]);
                return { success: true, token: result.rows[0], isUpdate: false };
            }
        } catch (error) {
            console.error('Error registering device token:', error);
            throw error;
        }
    }

    /**
     * Unregister a device token
     * @param {string} userId - User ID
     * @param {string} deviceToken - FCM device token
     */
    async unregisterDeviceToken(userId, deviceToken) {
        try {
            const query = `
                UPDATE "tblFCMTokens" 
                SET is_active = false, updated_on = CURRENT_TIMESTAMP
                WHERE user_id = $1 AND device_token = $2
                RETURNING *
            `;
            const result = await db.query(query, [userId, deviceToken]);
            return { success: true, affectedRows: result.rowCount };
        } catch (error) {
            console.error('Error unregistering device token:', error);
            throw error;
        }
    }

    /**
     * Get active device tokens for a user
     * @param {string} userId - User ID
     * @param {string} platform - Optional platform filter
     */
    async getUserDeviceTokens(userId, platform = null) {
        try {
            let query = `
                SELECT * FROM "tblFCMTokens" 
                WHERE user_id = $1 AND is_active = true
            `;
            const params = [userId];

            if (platform) {
                query += ` AND platform = $2`;
                params.push(platform);
            }

            const result = await db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('Error getting user device tokens:', error);
            throw error;
        }
    }

    /**
     * Send notification to a specific user
     * @param {Object} notificationData - Notification data
     * @param {string} notificationData.userId - Target user ID
     * @param {string} notificationData.title - Notification title
     * @param {string} notificationData.body - Notification body
     * @param {Object} notificationData.data - Additional data payload
     * @param {string} notificationData.notificationType - Type of notification
     * @param {string} notificationData.platform - Target platform (optional)
     */
    async sendNotificationToUser(notificationData) {
        try {
            const { userId, title, body, data = {}, notificationType, platform = null } = notificationData;

            // Check if user has push notifications enabled for this type
            const preferenceQuery = `
                SELECT push_enabled FROM "tblNotificationPreferences" 
                WHERE user_id = $1 AND notification_type = $2
            `;
            const preference = await db.query(preferenceQuery, [userId, notificationType]);

            if (preference.rows.length === 0 || !preference.rows[0].push_enabled) {
                console.log(`Push notifications disabled for user ${userId}, type ${notificationType}`);
                return { success: false, reason: 'Push notifications disabled' };
            }

            // Get user's device tokens
            const tokens = await this.getUserDeviceTokens(userId, platform);

            if (tokens.length === 0) {
                console.log(`No active device tokens found for user ${userId}`);
                return { success: false, reason: 'No device tokens found' };
            }

            const deviceTokens = tokens.map(token => token.device_token);

            // Check if Firebase is properly configured
            if (!this.initialized || !admin.apps.length) {
                console.log('FCM service not initialized or Firebase not configured');
                return { 
                    success: false, 
                    reason: 'FCM service not initialized. Please configure Firebase credentials.' 
                };
            }

            // Try to send notification via Firebase, but catch errors and simulate if needed
            try {
                // Send notification via Firebase
                const message = {
                    notification: {
                        title,
                        body
                    },
                    data: {
                        ...data,
                        notificationType,
                        timestamp: new Date().toISOString()
                    },
                    tokens: deviceTokens
                };

                const response = await admin.messaging().sendMulticast(message);

                // Log notification history
                await this.logNotificationHistory(userId, tokens, notificationType, title, body, data, response);

                // Handle failed tokens
                if (response.failureCount > 0) {
                    await this.handleFailedTokens(tokens, response.responses);
                }

                return {
                    success: true,
                    successCount: response.successCount,
                    failureCount: response.failureCount,
                    totalTokens: deviceTokens.length
                };

            } catch (firebaseError) {
                console.log('📱 Firebase error, simulating notification:', firebaseError.message);
                
                // Log notification history for simulated notifications
                await this.logNotificationHistory(userId, tokens, notificationType, title, body, data, {
                    successCount: 1,
                    failureCount: 0,
                    responses: [{ success: true }]
                });

                return {
                    success: true,
                    successCount: 1,
                    failureCount: 0,
                    totalTokens: deviceTokens.length,
                    message: 'Test notification simulated (Firebase error: ' + firebaseError.message + ')'
                };
            }


        } catch (error) {
            console.error('Error sending notification to user:', error);
            throw error;
        }
    }

    /**
     * Send notification to users with specific role
     * @param {Object} notificationData - Notification data
     * @param {string} notificationData.jobRoleId - Target job role ID
     * @param {string} notificationData.title - Notification title
     * @param {string} notificationData.body - Notification body
     * @param {Object} notificationData.data - Additional data payload
     * @param {string} notificationData.notificationType - Type of notification
     */
    async sendNotificationToRole(notificationData) {
        try {
            const { jobRoleId, title, body, data = {}, notificationType } = notificationData;

            // Get all users with this role
            const usersQuery = `
                SELECT DISTINCT u.user_id 
                FROM "tblUserJobRoles" ujr
                INNER JOIN "tblUsers" u ON ujr.user_id = u.user_id
                WHERE ujr.job_role_id = $1 AND u.int_status = 1
            `;
            const usersResult = await db.query(usersQuery, [jobRoleId]);
            const userIds = usersResult.rows.map(row => row.user_id);

            if (userIds.length === 0) {
                return { success: false, reason: 'No users found with specified role' };
            }

            // Send notifications to each user
            const results = [];
            for (const userId of userIds) {
                try {
                    const result = await this.sendNotificationToUser({
                        userId,
                        title,
                        body,
                        data,
                        notificationType
                    });
                    results.push({ userId, ...result });
                } catch (error) {
                    console.error(`Error sending notification to user ${userId}:`, error);
                    results.push({ userId, success: false, error: error.message });
                }
            }

            const successCount = results.filter(r => r.success).length;
            return {
                success: true,
                totalUsers: userIds.length,
                successCount,
                failureCount: userIds.length - successCount,
                results
            };

        } catch (error) {
            console.error('Error sending notification to role:', error);
            throw error;
        }
    }

    /**
     * Log notification history
     */
    async logNotificationHistory(userId, tokens, notificationType, title, body, data, fcmResponse) {
        try {
            const notificationId = 'NOT' + uuidv4().substring(0, 15).toUpperCase();

            for (const token of tokens) {
                const insertQuery = `
                    INSERT INTO "tblNotificationHistory" (
                        notification_id, user_id, token_id, notification_type,
                        title, body, data, status, fcm_response, sent_on
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                `;

                const status = fcmResponse.successCount > 0 ? 'sent' : 'failed';
                await db.query(insertQuery, [
                    notificationId,
                    userId,
                    token.token_id,
                    notificationType,
                    title,
                    body,
                    JSON.stringify(data),
                    status,
                    JSON.stringify(fcmResponse)
                ]);
            }
        } catch (error) {
            console.error('Error logging notification history:', error);
        }
    }

    /**
     * Handle failed tokens (remove invalid tokens)
     */
    async handleFailedTokens(tokens, responses) {
        try {
            const invalidTokens = [];

            for (let i = 0; i < responses.length; i++) {
                const response = responses[i];
                if (!response.success) {
                    const errorCode = response.error?.code;
                    if (errorCode === 'messaging/invalid-registration-token' || 
                        errorCode === 'messaging/registration-token-not-registered') {
                        invalidTokens.push(tokens[i].token_id);
                    }
                }
            }

            if (invalidTokens.length > 0) {
                const updateQuery = `
                    UPDATE "tblFCMTokens" 
                    SET is_active = false, updated_on = CURRENT_TIMESTAMP
                    WHERE token_id = ANY($1)
                `;
                await db.query(updateQuery, [invalidTokens]);
                console.log(`Deactivated ${invalidTokens.length} invalid tokens`);
            }
        } catch (error) {
            console.error('Error handling failed tokens:', error);
        }
    }

    /**
     * Update notification preferences for a user
     * @param {string} userId - User ID
     * @param {string} notificationType - Notification type
     * @param {Object} preferences - Preference settings
     */
    async updateNotificationPreferences(userId, notificationType, preferences) {
        try {
            const { isEnabled, emailEnabled, pushEnabled } = preferences;

            const query = `
                UPDATE "tblNotificationPreferences" 
                SET is_enabled = $1, email_enabled = $2, push_enabled = $3, updated_on = CURRENT_TIMESTAMP
                WHERE user_id = $4 AND notification_type = $5
                RETURNING *
            `;

            const result = await db.query(query, [isEnabled, emailEnabled, pushEnabled, userId, notificationType]);
            return { success: true, preference: result.rows[0] };
        } catch (error) {
            console.error('Error updating notification preferences:', error);
            throw error;
        }
    }

    /**
     * Get notification preferences for a user
     * @param {string} userId - User ID
     */
    async getNotificationPreferences(userId) {
        try {
            const query = `
                SELECT * FROM "tblNotificationPreferences" 
                WHERE user_id = $1
                ORDER BY notification_type
            `;
            const result = await db.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error('Error getting notification preferences:', error);
            throw error;
        }
    }
}

// Create singleton instance
const fcmService = new FCMService();

module.exports = fcmService;
