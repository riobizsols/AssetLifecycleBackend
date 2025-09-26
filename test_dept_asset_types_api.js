const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual token

// Test data - replace with actual department ID from your database
const TEST_DEPT_ID = 'DEPT001'; // Replace with actual department ID

// Create axios instance with auth header
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Test function to get asset types by department
async function testGetAssetTypesByDepartment() {
  console.log('🧪 Testing get asset types by department API...');
  
  try {
    const response = await api.get(`/dept-assets/department/${TEST_DEPT_ID}/asset-types`);
    
    console.log('✅ API Response Status:', response.status);
    console.log('✅ API Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log(`✅ Found ${response.data.count} asset types for department ${TEST_DEPT_ID}`);
      console.log(`✅ Department: ${response.data.department.dept_name}`);
      
      if (response.data.data.length > 0) {
        console.log('📋 Asset Types:');
        response.data.data.forEach((assetType, index) => {
          console.log(`  ${index + 1}. ${assetType.asset_type_name} (ID: ${assetType.asset_type_id})`);
        });
      } else {
        console.log('ℹ️  No asset types found for this department');
      }
    } else {
      console.log('❌ API returned success: false');
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('ℹ️  Department not found - this is expected if the department ID is invalid');
    } else if (error.response?.status === 401) {
      console.log('ℹ️  Authentication failed - please check your token');
    }
  }
}

// Test function with invalid department ID
async function testGetAssetTypesByInvalidDepartment() {
  console.log('\n🧪 Testing with invalid department ID...');
  
  try {
    const response = await api.get('/dept-assets/department/INVALID_DEPT_ID/asset-types');
    console.log('❌ Should have failed but got response:', response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('✅ Correctly returned 404 for invalid department ID');
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
}

// Test function without department ID
async function testGetAssetTypesWithoutDepartmentId() {
  console.log('\n🧪 Testing without department ID...');
  
  try {
    const response = await api.get('/dept-assets/department//asset-types');
    console.log('❌ Should have failed but got response:', response.data);
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('✅ Correctly returned 404 for missing department ID');
    } else {
      console.error('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Department Asset Types API Tests\n');
  console.log('📝 Note: Make sure to update TEST_TOKEN and TEST_DEPT_ID with valid values\n');
  
  await testGetAssetTypesByDepartment();
  await testGetAssetTypesByInvalidDepartment();
  await testGetAssetTypesWithoutDepartmentId();
  
  console.log('\n🏁 Tests completed!');
  console.log('\n📋 API Endpoint: GET /api/dept-assets/department/:dept_id/asset-types');
  console.log('📋 Description: Get all asset types assigned to a specific department');
  console.log('📋 Parameters: dept_id (required) - Department ID');
  console.log('📋 Response: JSON with asset types data and department information');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testGetAssetTypesByDepartment,
  testGetAssetTypesByInvalidDepartment,
  testGetAssetTypesWithoutDepartmentId,
  runTests
};
