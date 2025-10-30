const fcmService = require('./services/fcmService');
const db = require('./config/db');

async function testFCMWithRealUser() {
    try {
        console.log('🧪 Testing FCM Service with real user...\n');
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('FCM Service initialized:', fcmService.initialized);
        
        // Check if user has notification preferences
        const prefQuery = `
            SELECT notification_type, is_enabled, push_enabled 
            FROM "tblNotificationPreferences" 
            WHERE user_id = $1 AND notification_type = 'test_notification'
        `;
        const prefResult = await db.query(prefQuery, ['USR002']);
        
        if (prefResult.rows.length === 0) {
            console.log('⚠️  No test_notification preferences found. Creating them...');
            
            // Create notification preference for test_notification
            const insertPrefQuery = `
                INSERT INTO "tblNotificationPreferences" (
                    preference_id, user_id, notification_type, 
                    is_enabled, email_enabled, push_enabled
                ) VALUES ($1, $2, 'test_notification', true, true, true)
            `;
            const prefId = 'PREF_TEST_USR002';
            await db.query(insertPrefQuery, [prefId, 'USR002']);
            console.log('✅ Created test_notification preferences');
        } else {
            const pref = prefResult.rows[0];
            console.log(`✅ Notification preferences: enabled=${pref.is_enabled}, push=${pref.push_enabled}`);
        }
        
        // Check device tokens
        const tokenQuery = `
            SELECT token_id, device_token, platform, is_active 
            FROM "tblFCMTokens" 
            WHERE user_id = $1 AND is_active = true
        `;
        const tokenResult = await db.query(tokenQuery, ['USR002']);
        
        console.log(`📱 Found ${tokenResult.rows.length} active device tokens for USR002`);
        tokenResult.rows.forEach((token, index) => {
            console.log(`   Token ${index + 1}: ${token.platform} - ${token.device_token.substring(0, 30)}...`);
        });
        
        if (fcmService.initialized) {
            console.log('✅ FCM Service is ready');
            
            // Test with a real user
            console.log('\n📱 Testing notification with real user...');
            
            const testResult = await fcmService.sendNotificationToUser({
                userId: 'USR002', // User with real FCM tokens
                title: 'Real Token Test',
                body: 'Testing with real FCM device tokens',
                data: { type: 'real_test' },
                notificationType: 'test_notification'
            });
            
            console.log('Test result:', testResult);
            
        } else {
            console.log('❌ FCM Service not initialized');
        }
        
    } catch (error) {
        console.error('❌ FCM Service test failed:', error);
    } finally {
        // Close database connection
        if (db && db.end) {
            await db.end();
        }
    }
}

// Run the test
if (require.main === module) {
    testFCMWithRealUser();
}

module.exports = { testFCMWithRealUser };
