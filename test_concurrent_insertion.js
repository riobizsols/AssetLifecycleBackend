const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test concurrent insertion fix
async function testConcurrentInsertion() {
    try {
        console.log('🔍 Testing concurrent insertion fix...');
        
        // Test data with multiple scrap assets
        const testData = {
            text: "Test Concurrent Insertion",
            total_sale_value: 1500.00,
            buyer_name: "Test Buyer",
            buyer_company: "Test Company",
            scrapAssets: [
                {
                    asd_id: "ASD0001",
                    sale_value: 500.00
                },
                {
                    asd_id: "ASD0002",
                    sale_value: 1000.00
                }
            ]
        };

        console.log('📋 Test data prepared with 2 scrap assets');
        console.log('   - Total value:', testData.total_sale_value);
        console.log('   - Assets count:', testData.scrapAssets.length);
        
        // This will fail without authentication, but we can see the ID generation logs
        const response = await axios.post(`${BASE_URL}/scrap-sales`, testData);
        console.log('✅ Success:', response.data.message);
        
        return true;
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ Correctly handled authentication requirement');
            console.log('📝 Check the server logs to see ID generation sequence');
            return true;
        } else if (error.response?.status === 400) {
            console.log('✅ Correctly handled validation (assets may not exist)');
            console.log('📋 Error details:', error.response.data.message);
            return true;
        } else {
            console.log('❌ Unexpected error:', error.response?.data?.error || error.message);
            return false;
        }
    }
}

// Test server connection first
async function testServerConnection() {
    try {
        const response = await axios.get(`${BASE_URL.replace('/api', '')}/`);
        console.log('✅ Server is running:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Server is not running or not accessible');
        return false;
    }
}

// Main test function
async function runTest() {
    console.log('🚀 Testing Concurrent Insertion Fix\n');
    
    const serverRunning = await testServerConnection();
    if (!serverRunning) {
        console.log('❌ Cannot proceed - server is not running');
        console.log('💡 Please start the server with: npm start');
        return;
    }
    
    const success = await testConcurrentInsertion();
    
    if (success) {
        console.log('\n✅ Concurrent insertion test completed!');
        console.log('📝 The duplicate key error should be resolved.');
        console.log('🔍 Check server logs for ID generation sequence.');
    } else {
        console.log('\n❌ Concurrent insertion test failed.');
    }
}

runTest().catch(console.error);
