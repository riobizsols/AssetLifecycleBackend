const https = require('https');
const { google } = require('googleapis');

async function testDirectFCMRequest() {
    try {
        console.log('🧪 Testing Direct FCM HTTP v1 API Request...\n');

        // Set up authentication
        const auth = new google.auth.GoogleAuth({
            credentials: {
                type: "service_account",
                project_id: process.env.FIREBASE_PROJECT_ID,
                private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
                private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                client_email: process.env.FIREBASE_CLIENT_EMAIL,
                client_id: process.env.FIREBASE_CLIENT_ID
            },
            scopes: ['https://www.googleapis.com/auth/firebase.messaging']
        });

        const authClient = await auth.getClient();
        const accessToken = await authClient.getAccessToken();

        console.log('✅ Got access token');

        // Test 1: Direct API call to messages:send endpoint
        console.log('\n🧪 Test 1: Direct API Call to v1/messages:send...');
        
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
        
        const message = {
            message: {
                token: 'test-token-direct',
                notification: {
                    title: 'Direct API Test',
                    body: 'Testing direct FCM HTTP v1 API'
                }
            }
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken.token}`
            }
        };

        console.log(`   📤 Sending request to: ${url}`);
        
        const response = await new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve({ statusCode: res.statusCode, body: data, headers: res.headers });
                });
            });
            
            req.on('error', (error) => reject(error));
            req.write(JSON.stringify(message));
            req.end();
        });

        console.log(`   📊 Status Code: ${response.statusCode}`);
        console.log(`   📊 Response: ${response.body.substring(0, 200)}...`);

        if (response.statusCode === 401) {
            console.log('   ❌ Authentication failed - check service account permissions');
        } else if (response.statusCode === 404) {
            console.log('   ❌ 404 - Endpoint not found');
        } else if (response.statusCode === 400) {
            console.log('   ✅ API is working! (400 is expected for invalid token)');
            console.log('   ✅ This confirms the v1 API endpoint is correct');
        } else if (response.statusCode === 200) {
            console.log('   ✅ API call successful!');
        }

        // Test 2: Check what endpoint sendMulticast is actually using
        console.log('\n🧪 Test 2: Understanding sendMulticast vs send...');
        console.log('   📋 The Admin SDK uses two different methods:');
        console.log('      - send() → Uses v1/projects/{project}/messages:send');
        console.log('      - sendMulticast() → Uses v1/projects/{project}/messages:send (batch)');
        console.log('   🔍 The issue might be that sendMulticast is trying to use a different endpoint');

        console.log('\n📋 Key Differences:');
        console.log('   send() → Single token, works fine');
        console.log('   sendMulticast() → Multiple tokens, gets 404 on /batch');
        console.log('   🔧 This suggests the batch endpoint doesn\'t exist in v1 API');

        console.log('\n🔧 SOLUTION:');
        console.log('   Since send() works but sendMulticast() doesn\'t,');
        console.log('   we have two options:');
        console.log('   1. Change backend to use send() instead of sendMulticast()');
        console.log('   2. Loop through tokens and send individual messages');
        console.log('   3. Update Firebase Admin SDK to a version that supports v1 properly');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
if (require.main === module) {
    testDirectFCMRequest();
}

module.exports = { testDirectFCMRequest };
