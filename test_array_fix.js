const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test the validate assets endpoint with the array fix
async function testArrayFix() {
    try {
        console.log('🔍 Testing: Array handling fix for validate assets');
        
        // Test with a simple array of IDs
        const testAsdIds = ['ASD0001', 'ASD0002'];
        
        const response = await axios.post(`${BASE_URL}/scrap-sales/validate-assets`, {
            asdIds: testAsdIds
        });
        
        console.log('✅ Success: Array handling works correctly');
        console.log('📊 Response:', response.data.message);
        console.log('📋 Validation results:');
        console.log(`   - Total requested: ${response.data.validation.total_requested}`);
        console.log(`   - Valid assets: ${response.data.validation.valid_assets}`);
        console.log(`   - Already sold: ${response.data.validation.already_sold}`);
        console.log(`   - Invalid assets: ${response.data.validation.invalid_assets}`);
        
        return true;
    } catch (error) {
        if (error.response?.status === 400) {
            console.log('✅ Correctly handled validation (assets may not exist in database)');
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
    console.log('🚀 Testing Array Handling Fix\n');
    
    const serverRunning = await testServerConnection();
    if (!serverRunning) {
        console.log('❌ Cannot proceed - server is not running');
        console.log('💡 Please start the server with: npm start');
        return;
    }
    
    const success = await testArrayFix();
    
    if (success) {
        console.log('\n✅ Array handling fix test completed successfully!');
        console.log('📝 The malformed array literal error should be resolved.');
    } else {
        console.log('\n❌ Array handling fix test failed.');
    }
}

runTest().catch(console.error);
