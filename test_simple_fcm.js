const admin = require('firebase-admin');
require('dotenv').config();

async function testSimpleFCM() {
    try {
        console.log('🧪 Simple FCM Test...\n');

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
        console.log(`📋 Project ID: ${admin.app().options.projectId}`);

        // Test with a known working token format
        const testToken = 'test-token-for-validation';
        
        console.log('\n📤 Testing with test token...');
        
        try {
            const message = {
                notification: {
                    title: 'Test',
                    body: 'Test message'
                },
                token: testToken
            };

            await admin.messaging().send(message);
            console.log('✅ Message sent successfully');
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
            } else if (error.message.includes('403') || error.message.includes('permission')) {
                console.log('   ❌ Permission issue!');
                console.log('   🔧 Service account needs proper permissions');
            } else {
                console.log('   ⚠️  Unexpected error - needs investigation');
            }
        }

        console.log('\n📋 Next Steps:');
        console.log('1. If you see "Firebase is working correctly!" - your project is fine');
        console.log('2. If you see "Firebase project configuration issue!" - enable FCM in Firebase Console');
        console.log('3. If you see "Permission issue!" - check service account permissions');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testSimpleFCM();
}

module.exports = { testSimpleFCM };
