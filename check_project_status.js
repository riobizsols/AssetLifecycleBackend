const admin = require('firebase-admin');
require('dotenv').config();

async function checkProjectStatus() {
    try {
        console.log('🔍 Checking Firebase Project Status...\n');

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

        // Test project access
        console.log('\n🧪 Testing Project Access...');
        try {
            const app = admin.app();
            console.log(`   App Name: ${app.name}`);
            console.log(`   Project ID: ${app.options.projectId}`);
            console.log('   ✅ Project is accessible');
        } catch (error) {
            console.log('   ❌ Project access error:', error.message);
            return;
        }

        // Test FCM with detailed error
        console.log('\n🧪 Testing FCM with Detailed Error...');
        try {
            const message = {
                notification: { title: 'Test', body: 'Test' },
                tokens: ['test-token']
            };
            await admin.messaging().sendMulticast(message);
        } catch (error) {
            console.log('📊 Detailed Error Analysis:');
            console.log(`   Error Code: ${error.code}`);
            console.log(`   Error Message: ${error.message}`);
            console.log(`   Full Error: ${JSON.stringify(error, null, 2)}`);
            
            if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('\n🔧 SOLUTION:');
                console.log('   The 404 error means Firebase Cloud Messaging API is not enabled');
                console.log('   You need to enable it in Google Cloud Console');
                console.log('\n📋 Steps to Enable:');
                console.log('   1. Go to: https://console.cloud.google.com/apis/library');
                console.log('   2. Make sure you\'re in project: assetlifecyclemanagement');
                console.log('   3. Search for: "Firebase Cloud Messaging API"');
                console.log('   4. Click on it and click "Enable"');
                console.log('   5. Also enable: "Firebase Management API"');
                console.log('\n🔗 Direct Links:');
                console.log('   FCM API: https://console.cloud.google.com/apis/library/fcm.googleapis.com');
                console.log('   Firebase Management API: https://console.cloud.google.com/apis/library/firebase.googleapis.com');
            }
        }

    } catch (error) {
        console.error('❌ Check failed:', error);
    }
}

// Run the check
if (require.main === module) {
    checkProjectStatus();
}

module.exports = { checkProjectStatus };
