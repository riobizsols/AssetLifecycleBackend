const fcmService = require('./services/fcmService');
const db = require('./config/db');

async function testFCMWithRealToken() {
    try {
        console.log('🧪 Testing FCM with Real Device Token...\n');
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!fcmService.initialized) {
            console.log('❌ FCM Service not initialized');
            return;
        }

        // Get a real user
        const userQuery = `SELECT user_id, full_name FROM "tblUsers" WHERE int_status = 1 LIMIT 1`;
        const userResult = await db.query(userQuery);
        
        if (userResult.rows.length === 0) {
            console.log('❌ No active users found');
            return;
        }
        
        const testUserId = userResult.rows[0].user_id;
        const testUserName = userResult.rows[0].full_name;
        console.log(`✅ Using test user: ${testUserName} (${testUserId})`);

        // Instructions for getting a real token
        console.log('\n📱 To test with a real device token:');
        console.log('1. Install your mobile app or open your web app');
        console.log('2. Register for push notifications');
        console.log('3. Get the FCM token from the app');
        console.log('4. Use the API endpoint: POST /api/fcm/register-token');
        console.log('5. Then test notifications');
        
        console.log('\n🔧 Alternative: Test Firebase project configuration directly...');
        
        // Test Firebase project configuration
        const admin = require('firebase-admin');
        
        try {
            // This will test if the project is properly configured for FCM
            const message = {
                notification: {
                    title: 'Firebase Test',
                    body: 'Testing Firebase project configuration'
                },
                token: 'test-token-that-will-fail'
            };
            
            await admin.messaging().send(message);
        } catch (error) {
            console.log('\n📊 Firebase Error Analysis:');
            
            if (error.code === 'messaging/invalid-registration-token') {
                console.log('✅ Firebase project is properly configured!');
                console.log('   The error is expected for a test token.');
                console.log('   Your Firebase project is working correctly.');
            } else if (error.code === 'messaging/registration-token-not-registered') {
                console.log('✅ Firebase project is properly configured!');
                console.log('   The error is expected for a test token.');
                console.log('   Your Firebase project is working correctly.');
            } else if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('❌ Firebase project configuration issue detected!');
                console.log('   Error:', error.message);
                console.log('\n🔧 Fix Steps:');
                console.log('   1. Go to Firebase Console → Project Settings → Cloud Messaging');
                console.log('   2. Make sure Cloud Messaging is enabled');
                console.log('   3. Check that your project ID matches FIREBASE_PROJECT_ID');
                console.log('   4. Verify service account has Firebase Admin SDK permissions');
            } else {
                console.log('⚠️  Unexpected error:', error.message);
                console.log('   This might indicate a different configuration issue.');
            }
        }

        console.log('\n📋 Next Steps:');
        console.log('1. Fix Firebase project configuration if needed');
        console.log('2. Get a real FCM token from your mobile/web app');
        console.log('3. Register the token using POST /api/fcm/register-token');
        console.log('4. Test notifications with the real token');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        if (db && db.end) {
            await db.end();
        }
    }
}

// Run the test
if (require.main === module) {
    testFCMWithRealToken();
}

module.exports = { testFCMWithRealToken };
