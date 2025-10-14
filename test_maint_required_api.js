const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api/asset-types';
const TEST_USER = {
    email: 'admin@example.com',
    password: 'admin123'
};

let authToken = '';

// Login to get authentication token
async function login() {
    try {
        const response = await axios.post('http://localhost:5000/api/users/login', TEST_USER);
        authToken = response.data.token;
        console.log('✅ Login successful');
        console.log('Token:', authToken);
        return authToken;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
        throw error;
    }
}

// Test GET /api/asset-types/maint-required
async function testGetMaintRequiredAssetTypes() {
    console.log('\n📋 Testing GET /api/asset-types/maint-required');
    console.log('='.repeat(50));
    
    try {
        const response = await axios.get(`${BASE_URL}/maint-required`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('✅ Success!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log(`\n📊 Found ${response.data.count} asset types with maintenance required`);
            
            if (response.data.data && response.data.data.length > 0) {
                console.log('\nAsset Types:');
                response.data.data.forEach((assetType, index) => {
                    console.log(`\n${index + 1}. ${assetType.text} (${assetType.asset_type_id})`);
                    console.log(`   - Maint Required: ${assetType.maint_required}`);
                    console.log(`   - Status: ${assetType.int_status === 1 ? 'Active' : 'Inactive'}`);
                    console.log(`   - Assignment Type: ${assetType.assignment_type}`);
                    if (assetType.maint_type_id) {
                        console.log(`   - Maint Type ID: ${assetType.maint_type_id}`);
                    }
                    if (assetType.maint_lead_type) {
                        console.log(`   - Maint Lead Type: ${assetType.maint_lead_type}`);
                    }
                });
            }
        }
        
        return response.data;
    } catch (error) {
        console.error('❌ Test failed!');
        console.error('Error:', error.response?.data || error.message);
        throw error;
    }
}

// Main test runner
async function runTests() {
    console.log('🚀 Starting API Tests for Maintenance Required Asset Types');
    console.log('='.repeat(50));
    
    try {
        // Step 1: Login
        await login();
        
        // Step 2: Test the new endpoint
        await testGetMaintRequiredAssetTypes();
        
        console.log('\n✅ All tests completed successfully!');
    } catch (error) {
        console.error('\n❌ Test suite failed!');
        console.error(error.message);
        process.exit(1);
    }
}

// Run the tests
runTests();

