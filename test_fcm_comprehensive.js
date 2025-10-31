const fcmService = require('./services/fcmService');
const db = require('./config/db');

async function testFCMComprehensive() {
    try {
        console.log('🧪 Comprehensive FCM Test Starting...\n');
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('1. ✅ FCM Service Status:', fcmService.initialized ? 'Initialized' : 'Not Initialized');
        
        if (!fcmService.initialized) {
            console.log('❌ FCM Service not initialized. Please check Firebase configuration.');
            return;
        }

        // Test with a real user from your database
        console.log('\n2. 🔍 Finding a real user from database...');
        const userQuery = `SELECT user_id, full_name FROM "tblUsers" WHERE int_status = 1 LIMIT 1`;
        const userResult = await db.query(userQuery);
        
        if (userResult.rows.length === 0) {
            console.log('❌ No active users found in database');
            return;
        }
        
        const testUserId = userResult.rows[0].user_id;
        const testUserName = userResult.rows[0].full_name;
        console.log(`✅ Using test user: ${testUserName} (${testUserId})`);

        // Check notification preferences
        console.log('\n3. 🔔 Checking notification preferences...');
        const prefQuery = `
            SELECT notification_type, is_enabled, push_enabled 
            FROM "tblNotificationPreferences" 
            WHERE user_id = $1 AND notification_type = 'test_notification'
        `;
        const prefResult = await db.query(prefQuery, [testUserId]);
        
        if (prefResult.rows.length === 0) {
            console.log('⚠️  No test_notification preferences found. Creating them...');
            
            // Create notification preference for test_notification
            const insertPrefQuery = `
                INSERT INTO "tblNotificationPreferences" (
                    preference_id, user_id, notification_type, 
                    is_enabled, email_enabled, push_enabled
                ) VALUES ($1, $2, 'test_notification', true, true, true)
            `;
            const prefId = 'PREF_TEST_' + testUserId;
            await db.query(insertPrefQuery, [prefId, testUserId]);
            console.log('✅ Created test_notification preferences');
        } else {
            const pref = prefResult.rows[0];
            console.log(`✅ Notification preferences found: enabled=${pref.is_enabled}, push=${pref.push_enabled}`);
        }

        // Check device tokens
        console.log('\n4. 📱 Checking device tokens...');
        const tokenQuery = `
            SELECT token_id, device_token, platform, is_active 
            FROM "tblFCMTokens" 
            WHERE user_id = $1 AND is_active = true
        `;
        const tokenResult = await db.query(tokenQuery, [testUserId]);
        
        if (tokenResult.rows.length === 0) {
            console.log('⚠️  No device tokens found. Creating a test token...');
            
            // Create a test device token (this won't work for real notifications, but will test the flow)
            const testToken = 'test_token_' + Date.now();
            const tokenId = 'FCM_TEST_' + testUserId;
            
            const insertTokenQuery = `
                INSERT INTO "tblFCMTokens" (
                    token_id, user_id, device_token, device_type, platform, 
                    app_version, device_info, is_active, last_used
                ) VALUES ($1, $2, $3, 'mobile', 'android', '1.0.0', '{}', true, CURRENT_TIMESTAMP)
            `;
            await db.query(insertTokenQuery, [tokenId, testUserId, testToken]);
            console.log('✅ Created test device token');
        } else {
            console.log(`✅ Found ${tokenResult.rows.length} active device tokens`);
            tokenResult.rows.forEach((token, index) => {
                console.log(`   Token ${index + 1}: ${token.platform} (${token.is_active ? 'active' : 'inactive'})`);
            });
        }

        // Test sending notification
        console.log('\n5. 📤 Testing notification sending...');
        
        const testResult = await fcmService.sendNotificationToUser({
            userId: testUserId,
            title: 'Test Notification',
            body: 'This is a comprehensive test from FCM Service',
            data: { type: 'test', timestamp: new Date().toISOString() },
            notificationType: 'test_notification'
        });
        
        console.log('📊 Test Result:', JSON.stringify(testResult, null, 2));

        // Check notification history
        console.log('\n6. 📋 Checking notification history...');
        const historyQuery = `
            SELECT notification_id, title, body, status, sent_on 
            FROM "tblNotificationHistory" 
            WHERE user_id = $1 
            ORDER BY sent_on DESC 
            LIMIT 5
        `;
        const historyResult = await db.query(historyQuery, [testUserId]);
        
        if (historyResult.rows.length > 0) {
            console.log('✅ Recent notification history:');
            historyResult.rows.forEach((history, index) => {
                console.log(`   ${index + 1}. ${history.title} - ${history.status} (${history.sent_on})`);
            });
        } else {
            console.log('⚠️  No notification history found');
        }

        // Summary
        console.log('\n7. 📊 Test Summary:');
        console.log(`   - FCM Service: ${fcmService.initialized ? '✅ Working' : '❌ Not Working'}`);
        console.log(`   - Test User: ${testUserName} (${testUserId})`);
        console.log(`   - Notification Preferences: ${prefResult.rows.length > 0 ? '✅ Set' : '⚠️  Created'}`);
        console.log(`   - Device Tokens: ${tokenResult.rows.length > 0 ? '✅ Found' : '⚠️  Created'}`);
        console.log(`   - Notification Sent: ${testResult.success ? '✅ Success' : '❌ Failed'}`);
        
        if (testResult.success) {
            console.log(`   - Success Count: ${testResult.successCount}`);
            console.log(`   - Failure Count: ${testResult.failureCount}`);
            if (testResult.message) {
                console.log(`   - Message: ${testResult.message}`);
            }
        }

        console.log('\n🎉 Comprehensive FCM test completed!');
        
    } catch (error) {
        console.error('❌ Comprehensive FCM test failed:', error);
    } finally {
        // Close database connection
        if (db && db.end) {
            await db.end();
        }
    }
}

// Run the test
if (require.main === module) {
    testFCMComprehensive();
}

module.exports = { testFCMComprehensive };
