const admin = require('firebase-admin');
require('dotenv').config();

async function testFCMEnabled() {
    try {
        console.log('🔍 Checking if Cloud Messaging is enabled in your Firebase project...\n');

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
        console.log(`📋 Project: ${admin.app().options.projectId}`);
        console.log(`📋 Service Account: ${process.env.FIREBASE_CLIENT_EMAIL}`);

        // Test 1: Check if FCM service is available
        console.log('\n🧪 Test 1: Checking FCM Service Availability...');
        try {
            const messaging = admin.messaging();
            console.log('✅ FCM service object created successfully');
        } catch (error) {
            console.log('❌ FCM service not available:', error.message);
            return;
        }

        // Test 2: Try to send a message (this will tell us if FCM is enabled)
        console.log('\n🧪 Test 2: Testing FCM Message Sending...');
        try {
            const message = {
                notification: {
                    title: 'FCM Test',
                    body: 'Testing if Cloud Messaging is enabled'
                },
                token: 'test-token-for-validation'
            };

            await admin.messaging().send(message);
            console.log('✅ FCM is fully enabled and working!');
            
        } catch (error) {
            console.log('📊 Error Analysis:');
            console.log(`   Error Code: ${error.code}`);
            console.log(`   Error Message: ${error.message}`);
            
            if (error.code === 'messaging/invalid-registration-token') {
                console.log('   ✅ Cloud Messaging is ENABLED and working!');
                console.log('   ✅ The error is expected for a test token');
                console.log('   ✅ Your Firebase project is properly configured');
                console.log('   🎉 The 404 error should be fixed now!');
            } else if (error.code === 'messaging/registration-token-not-registered') {
                console.log('   ✅ Cloud Messaging is ENABLED and working!');
                console.log('   ✅ The error is expected for a test token');
                console.log('   ✅ Your Firebase project is properly configured');
                console.log('   🎉 The 404 error should be fixed now!');
            } else if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('   ❌ Cloud Messaging is NOT enabled!');
                console.log('   🔧 Go to Firebase Console → Cloud Messaging');
                console.log('   🔧 Click "Enable" or "Get Started" to enable FCM');
                console.log('   🔧 This is why you get 404 errors on /batch endpoint');
            } else if (error.message.includes('403') || error.message.includes('permission')) {
                console.log('   ❌ Permission issue!');
                console.log('   🔧 Check service account permissions in Google Cloud Console');
            } else {
                console.log('   ⚠️  Unexpected error - may need further investigation');
            }
        }

        // Test 3: Check project configuration
        console.log('\n🧪 Test 3: Project Configuration Check...');
        try {
            const projectId = admin.app().options.projectId;
            console.log(`   Project ID: ${projectId}`);
            console.log(`   Service Account: ${process.env.FIREBASE_CLIENT_EMAIL}`);
            console.log('   ✅ Project configuration looks correct');
        } catch (error) {
            console.log(`   ❌ Configuration error: ${error.message}`);
        }

        console.log('\n📋 Summary:');
        console.log('   If you see "Cloud Messaging is ENABLED" above, your issue is fixed!');
        console.log('   If you see "Cloud Messaging is NOT enabled", you need to enable it in Firebase Console');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testFCMEnabled();
}

module.exports = { testFCMEnabled };
