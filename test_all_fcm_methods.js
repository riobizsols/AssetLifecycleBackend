const admin = require('firebase-admin');
require('dotenv').config();

async function testAllFCMMethods() {
    try {
        console.log('🧪 Testing All FCM Methods After API Enablement...\n');

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

        // Test 1: Single message (should work)
        console.log('\n🧪 Test 1: Single Message (admin.messaging().send)...');
        try {
            const singleMessage = {
                notification: { title: 'Single Test', body: 'Testing single message' },
                token: 'test-token-single'
            };
            await admin.messaging().send(singleMessage);
            console.log('   ✅ Single message sent successfully');
        } catch (error) {
            console.log(`   📊 Error: ${error.code} - ${error.message.substring(0, 80)}...`);
            if (error.code === 'messaging/invalid-registration-token') {
                console.log('   ✅ This is expected for test token - FCM is working!');
            }
        }

        // Test 2: Multicast message (this is what fails with 404)
        console.log('\n🧪 Test 2: Multicast Message (admin.messaging().sendMulticast)...');
        try {
            const multicastMessage = {
                notification: { title: 'Multicast Test', body: 'Testing multicast message' },
                tokens: ['test-token-multicast']
            };
            await admin.messaging().sendMulticast(multicastMessage);
            console.log('   ✅ Multicast message sent successfully');
        } catch (error) {
            console.log(`   📊 Error: ${error.code} - ${error.message.substring(0, 80)}...`);
            if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('   ❌ Still getting 404 error on /batch endpoint');
                console.log('   🔧 This suggests the issue is not with API enablement');
            } else if (error.code === 'messaging/invalid-registration-token') {
                console.log('   ✅ This is expected for test token - FCM is working!');
            }
        }

        // Test 3: Check if we need to wait for propagation
        console.log('\n🧪 Test 3: Checking API Propagation...');
        console.log('   ⏰ API changes can take a few minutes to propagate');
        console.log('   🔄 Let\'s wait 30 seconds and try again...');
        
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        console.log('   🔄 Retrying multicast after 30 seconds...');
        try {
            const retryMessage = {
                notification: { title: 'Retry Test', body: 'Testing after wait' },
                tokens: ['test-token-retry']
            };
            await admin.messaging().sendMulticast(retryMessage);
            console.log('   ✅ Retry successful!');
        } catch (error) {
            console.log(`   📊 Retry Error: ${error.code} - ${error.message.substring(0, 80)}...`);
            if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('   ❌ Still getting 404 error after wait');
            } else if (error.code === 'messaging/invalid-registration-token') {
                console.log('   ✅ This is expected for test token - FCM is working!');
            }
        }

        // Test 4: Check if there are other required APIs
        console.log('\n🧪 Test 4: Checking for Additional Required APIs...');
        console.log('   📋 You have enabled:');
        console.log('   ✅ Firebase Cloud Messaging API');
        console.log('   ✅ Firebase Cloud Messaging Data API');
        console.log('   📋 You might also need:');
        console.log('   🔍 Firebase Management API');
        console.log('   🔍 Google Cloud Messaging API (legacy)');
        console.log('   🔍 Firebase Installations API');

        console.log('\n📋 Next Steps:');
        console.log('   1. Wait a few more minutes for API propagation');
        console.log('   2. Try enabling Firebase Management API');
        console.log('   3. Check if there are any billing or quota issues');
        console.log('   4. Verify the project is not in a restricted state');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testAllFCMMethods();
}

module.exports = { testAllFCMMethods };
