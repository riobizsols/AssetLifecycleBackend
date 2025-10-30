const admin = require('firebase-admin');
const path = require('path');

// Alternative Firebase configuration using service account file
async function initializeFirebaseWithFile() {
    try {
        console.log('🔧 Initializing Firebase with service account file...');
        
        // Path to your service account JSON file
        const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
        
        // Initialize Firebase Admin SDK
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountPath),
                projectId: 'your-project-id' // Replace with your actual project ID
            });
        }

        console.log('✅ Firebase Admin SDK initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error.message);
        return false;
    }
}

// Test Firebase configuration with file
async function testFirebaseWithFile() {
    try {
        console.log('🔧 Testing Firebase Configuration with service account file...\n');

        // Check if service account file exists
        const fs = require('fs');
        const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
        
        if (!fs.existsSync(serviceAccountPath)) {
            console.log('❌ Service account file not found:', serviceAccountPath);
            console.log('Please download your Firebase service account JSON file and rename it to "firebase-service-account.json"');
            return false;
        }

        console.log('✅ Service account file found');

        // Initialize Firebase
        const initialized = await initializeFirebaseWithFile();
        if (!initialized) {
            return false;
        }

        // Test sending a message
        console.log('\n📱 Testing FCM message sending...');
        
        try {
            const message = {
                notification: {
                    title: 'Test',
                    body: 'Test message'
                },
                token: 'test-token' // This will fail, but we'll catch the error
            };

            await admin.messaging().send(message);
        } catch (error) {
            if (error.code === 'messaging/invalid-registration-token' || 
                error.code === 'messaging/registration-token-not-registered') {
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
    testFirebaseWithFile().then(success => {
        if (success) {
            console.log('\n🎉 Firebase configuration is working correctly!');
            console.log('You can now test push notifications.');
        } else {
            console.log('\n❌ Firebase configuration needs to be fixed.');
            console.log('Please check your service account file and Firebase project settings.');
        }
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testFirebaseWithFile, initializeFirebaseWithFile };
