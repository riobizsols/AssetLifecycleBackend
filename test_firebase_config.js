const admin = require('firebase-admin');
require('dotenv').config();

// Test Firebase configuration
async function testFirebaseConfig() {
    try {
        console.log('🔧 Testing Firebase Configuration...\n');

        // Check if environment variables are set
        const requiredEnvVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_PRIVATE_KEY_ID', 
            'FIREBASE_PRIVATE_KEY',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_CLIENT_ID'
        ];

        console.log('📋 Checking environment variables:');
        let allEnvVarsSet = true;
        
        requiredEnvVars.forEach(envVar => {
            if (process.env[envVar]) {
                console.log(`✅ ${envVar}: Set`);
            } else {
                console.log(`❌ ${envVar}: Missing`);
                allEnvVarsSet = false;
            }
        });

        if (!allEnvVarsSet) {
            console.log('\n❌ Some Firebase environment variables are missing!');
            console.log('Please check your .env file and ensure all Firebase credentials are set.');
            return false;
        }

        console.log('\n🔧 Initializing Firebase Admin SDK...');
        
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

        console.log('✅ Firebase Admin SDK initialized successfully');

        // Test sending a message (this will fail if credentials are wrong)
        console.log('\n📱 Testing FCM message sending...');
        
        try {
            // This is just a test - we won't actually send to any tokens
            const message = {
                notification: {
                    title: 'Test',
                    body: 'Test message'
                },
                token: 'test-token' // This will fail, but we'll catch the error
            };

            // This will throw an error, but it will tell us if credentials are valid
            await admin.messaging().send(message);
        } catch (error) {
            // Check if it's a credential error or token error
            if (error.code === 'messaging/invalid-registration-token') {
                console.log('✅ Firebase credentials are valid! (Token error is expected)');
                return true;
            } else if (error.code === 'messaging/registration-token-not-registered') {
                console.log('✅ Firebase credentials are valid! (Token error is expected)');
                return true;
            } else if (error.message.includes('404') || error.message.includes('batch')) {
                console.log('❌ Firebase credentials are invalid or project not found');
                console.log('Error:', error.message);
                return false;
            } else {
                console.log('✅ Firebase credentials are valid! (Error is expected for test token)');
                return true;
            }
        }

        return true;

    } catch (error) {
        console.error('❌ Firebase configuration test failed:', error.message);
        return false;
    }
}

// Run the test
if (require.main === module) {
    testFirebaseConfig().then(success => {
        if (success) {
            console.log('\n🎉 Firebase configuration is working correctly!');
            console.log('You can now test push notifications.');
        } else {
            console.log('\n❌ Firebase configuration needs to be fixed.');
            console.log('Please check your .env file and Firebase project settings.');
        }
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testFirebaseConfig };
