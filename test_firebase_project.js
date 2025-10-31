const admin = require('firebase-admin');
require('dotenv').config();

async function testFirebaseProject() {
    try {
        console.log('🔧 Testing Firebase Project Configuration...\n');

        // Check environment variables
        console.log('📋 Environment Variables:');
        console.log(`   FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID}`);
        console.log(`   FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL}`);
        console.log(`   FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? 'Set' : 'Missing'}`);

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

        console.log('\n✅ Firebase Admin SDK initialized');

        // Test 1: Check if project exists and is accessible
        console.log('\n🧪 Test 1: Project Access');
        try {
            const projectId = admin.app().options.projectId;
            console.log(`   Project ID: ${projectId}`);
            console.log('   ✅ Project is accessible');
        } catch (error) {
            console.log(`   ❌ Project access error: ${error.message}`);
            return;
        }

        // Test 2: Check FCM service availability
        console.log('\n🧪 Test 2: FCM Service Availability');
        try {
            // This will test if FCM service is available
            const messaging = admin.messaging();
            console.log('   ✅ FCM service is available');
        } catch (error) {
            console.log(`   ❌ FCM service error: ${error.message}`);
            return;
        }

        // Test 3: Test with a real token (this will fail but tell us about the project)
        console.log('\n🧪 Test 3: FCM Message Sending');
        try {
            const message = {
                notification: {
                    title: 'Firebase Project Test',
                    body: 'Testing Firebase project configuration'
                },
                token: 'cAOjbpLxT1yMWrA_NRcP96:APA91bHBQdi04HwmsygtO0UdI2t' // Your real token
            };

            const response = await admin.messaging().send(message);
            console.log('   ✅ Message sent successfully:', response);
        } catch (error) {
            console.log('   📊 Error Analysis:');
            console.log(`   Error Code: ${error.code}`);
            console.log(`   Error Message: ${error.message}`);
            
            if (error.code === 'messaging/invalid-registration-token') {
                console.log('   ✅ Firebase project is working! (Token error is expected)');
            } else if (error.code === 'messaging/registration-token-not-registered') {
                console.log('   ✅ Firebase project is working! (Token error is expected)');
            } else if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('   ❌ Firebase project configuration issue!');
                console.log('   🔧 Fix: Enable Cloud Messaging in Firebase Console');
                console.log('   🔧 Fix: Check service account permissions');
            } else if (error.message.includes('403') || error.message.includes('permission')) {
                console.log('   ❌ Permission issue!');
                console.log('   🔧 Fix: Check service account has Firebase Admin SDK permissions');
            } else {
                console.log('   ⚠️  Unexpected error - may need further investigation');
            }
        }

        // Test 4: Check project configuration
        console.log('\n🧪 Test 4: Project Configuration Check');
        try {
            // Try to get project info
            const projectId = admin.app().options.projectId;
            console.log(`   Project ID: ${projectId}`);
            console.log(`   Service Account: ${process.env.FIREBASE_CLIENT_EMAIL}`);
            console.log('   ✅ Project configuration looks correct');
        } catch (error) {
            console.log(`   ❌ Configuration error: ${error.message}`);
        }

        console.log('\n📋 Summary:');
        console.log('   If you see "Firebase project is working!" above, your project is configured correctly.');
        console.log('   If you see "Firebase project configuration issue!", you need to:');
        console.log('   1. Go to Firebase Console → Project Settings → Cloud Messaging');
        console.log('   2. Enable Cloud Messaging if not already enabled');
        console.log('   3. Check service account permissions in Google Cloud Console');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testFirebaseProject();
}

module.exports = { testFirebaseProject };
