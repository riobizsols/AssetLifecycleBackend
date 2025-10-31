const admin = require('firebase-admin');
require('dotenv').config();

async function diagnoseFCMIssue() {
    try {
        console.log('🔍 Diagnosing FCM 404 Error...\n');

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

        // Test 1: Check Firebase Admin SDK version
        console.log('\n🧪 Test 1: Firebase Admin SDK Version...');
        const packageJson = require('./package.json');
        const firebaseAdminVersion = packageJson.dependencies['firebase-admin'];
        console.log(`   Firebase Admin SDK Version: ${firebaseAdminVersion}`);

        // Test 2: Check if project ID is correct
        console.log('\n🧪 Test 2: Project ID Validation...');
        const projectId = admin.app().options.projectId;
        console.log(`   Project ID from SDK: ${projectId}`);
        console.log(`   Project ID from ENV: ${process.env.FIREBASE_PROJECT_ID}`);
        
        if (projectId !== process.env.FIREBASE_PROJECT_ID) {
            console.log('   ⚠️  Project ID mismatch detected!');
        } else {
            console.log('   ✅ Project ID matches');
        }

        // Test 3: Check service account permissions
        console.log('\n🧪 Test 3: Service Account Permissions...');
        try {
            // Try to access Firebase project info
            const app = admin.app();
            console.log(`   App Name: ${app.name}`);
            console.log(`   Project ID: ${app.options.projectId}`);
            console.log('   ✅ Service account has basic Firebase access');
        } catch (error) {
            console.log('   ❌ Service account permission issue:', error.message);
        }

        // Test 4: Test different FCM methods
        console.log('\n🧪 Test 4: Testing Different FCM Methods...');
        
        // Test 4a: Single message
        console.log('   4a. Testing single message...');
        try {
            const singleMessage = {
                notification: { title: 'Test', body: 'Test' },
                token: 'test-token'
            };
            await admin.messaging().send(singleMessage);
        } catch (error) {
            console.log(`      Error: ${error.code} - ${error.message.substring(0, 100)}...`);
        }

        // Test 4b: Multicast message (what your backend uses)
        console.log('   4b. Testing multicast message...');
        try {
            const multicastMessage = {
                notification: { title: 'Test', body: 'Test' },
                tokens: ['test-token']
            };
            await admin.messaging().sendMulticast(multicastMessage);
        } catch (error) {
            console.log(`      Error: ${error.code} - ${error.message.substring(0, 100)}...`);
            if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('      ❌ This is the 404 error you\'re seeing!');
            }
        }

        // Test 5: Check Firebase project status
        console.log('\n🧪 Test 5: Firebase Project Status...');
        try {
            // Try to get project info
            const projectId = admin.app().options.projectId;
            console.log(`   Project ID: ${projectId}`);
            console.log(`   Service Account: ${process.env.FIREBASE_CLIENT_EMAIL}`);
            console.log('   ✅ Project appears to be active');
        } catch (error) {
            console.log('   ❌ Project status issue:', error.message);
        }

        // Test 6: Check if it's a regional issue
        console.log('\n🧪 Test 6: Regional Configuration...');
        try {
            // Check if there are any regional settings
            const app = admin.app();
            console.log(`   Project ID: ${app.options.projectId}`);
            console.log('   ✅ No regional configuration issues detected');
        } catch (error) {
            console.log('   ❌ Regional configuration issue:', error.message);
        }

        console.log('\n📋 Diagnosis Summary:');
        console.log('   If you see 404 errors in Test 4b, the issue is with FCM API not being enabled');
        console.log('   If you see different errors, the issue might be elsewhere');
        console.log('   The 404 error specifically means the /batch endpoint is not available');

        console.log('\n🔧 Next Steps:');
        console.log('   1. Go to Google Cloud Console → APIs & Services → Library');
        console.log('   2. Search for "Firebase Cloud Messaging API"');
        console.log('   3. Make sure it\'s enabled for your project');
        console.log('   4. Also check "Firebase Management API"');

    } catch (error) {
        console.error('❌ Diagnosis failed:', error);
    }
}

// Run the diagnosis
if (require.main === module) {
    diagnoseFCMIssue();
}

module.exports = { diagnoseFCMIssue };
