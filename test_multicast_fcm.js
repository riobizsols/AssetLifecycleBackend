const admin = require('firebase-admin');
require('dotenv').config();

async function testMulticastFCM() {
    try {
        console.log('🧪 Testing FCM with sendMulticast (same as backend)...\n');

        // Initialize Firebase Admin SDK
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

        console.log('✅ Firebase Admin SDK initialized');

        // Test with sendMulticast (same as your backend)
        const message = {
            notification: {
                title: 'Multicast Test',
                body: 'Testing with sendMulticast method'
            },
            data: {
                type: 'test',
                timestamp: new Date().toISOString()
            },
            tokens: ['test-token-for-validation'] // Single token in array
        };

        console.log('📤 Testing sendMulticast...');
        
        try {
            const response = await admin.messaging().sendMulticast(message);
            console.log('✅ Success! Response:', response);
        } catch (error) {
            console.log('📊 Error Analysis:');
            console.log(`   Code: ${error.code}`);
            console.log(`   Message: ${error.message}`);
            
            if (error.code === 'messaging/invalid-registration-token') {
                console.log('   ✅ Firebase is working correctly!');
                console.log('   ✅ The error is expected for a test token');
                console.log('   ✅ Your Firebase project is properly configured');
            } else if (error.code === 'messaging/registration-token-not-registered') {
                console.log('   ✅ Firebase is working correctly!');
                console.log('   ✅ The error is expected for a test token');
                console.log('   ✅ Your Firebase project is properly configured');
            } else if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('   ❌ Firebase project configuration issue!');
                console.log('   🔧 The /batch endpoint is not available');
                console.log('   🔧 This suggests FCM is not properly enabled');
                console.log('   🔧 Go to Firebase Console → Project Settings → Cloud Messaging');
            } else if (error.message.includes('403') || error.message.includes('permission')) {
                console.log('   ❌ Permission issue!');
                console.log('   🔧 Service account needs proper permissions');
                console.log('   🔧 Check Google Cloud Console → IAM & Admin → Service Accounts');
            } else {
                console.log('   ⚠️  Unexpected error - needs investigation');
                console.log('   🔧 This might be a Firebase project configuration issue');
            }
        }

        // Test with real token from database
        console.log('\n📱 Testing with real token from database...');
        
        try {
            const db = require('./config/db');
            const query = 'SELECT device_token FROM "tblFCMTokens" WHERE user_id = $1 AND is_active = true LIMIT 1';
            const result = await db.query(query, ['USR002']);
            
            if (result.rows.length > 0) {
                const realToken = result.rows[0].device_token;
                console.log(`   Real token: ${realToken.substring(0, 50)}...`);
                
                const realMessage = {
                    notification: {
                        title: 'Real Token Test',
                        body: 'Testing with real FCM token'
                    },
                    data: {
                        type: 'real_test',
                        timestamp: new Date().toISOString()
                    },
                    tokens: [realToken]
                };
                
                const realResponse = await admin.messaging().sendMulticast(realMessage);
                console.log('✅ Real token success! Response:', realResponse);
                
            } else {
                console.log('   ❌ No real tokens found in database');
            }
            
            if (db && db.end) {
                await db.end();
            }
            
        } catch (error) {
            console.log('📊 Real Token Error Analysis:');
            console.log(`   Code: ${error.code}`);
            console.log(`   Message: ${error.message}`);
            
            if (error.code === 'messaging/invalid-registration-token') {
                console.log('   ✅ Firebase is working! Token is invalid (might be expired)');
            } else if (error.code === 'messaging/registration-token-not-registered') {
                console.log('   ✅ Firebase is working! Token not registered (might be expired)');
            } else if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('   ❌ Firebase project configuration issue!');
                console.log('   🔧 This is the same 404 error you saw in your API');
                console.log('   🔧 The issue is with Firebase project configuration');
            } else {
                console.log('   ⚠️  Other error:', error.message);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testMulticastFCM();
}

module.exports = { testMulticastFCM };
