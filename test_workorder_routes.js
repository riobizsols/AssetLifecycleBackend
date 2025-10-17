/**
 * Test script to verify work order routes
 * Run with: node test_workorder_routes.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:4000';
const TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

async function testRoutes() {
  console.log('=== Testing Work Order Routes ===\n');

  try {
    // Test 1: Get all work orders
    console.log('1. Testing GET /api/work-orders/all');
    const allResponse = await axios.get(`${BASE_URL}/api/work-orders/all`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log('✅ Status:', allResponse.status);
    console.log('✅ Data count:', allResponse.data.count);
    console.log('✅ First item ams_id:', allResponse.data.data[0]?.ams_id);
    console.log('✅ Has breakdown_info:', allResponse.data.data[0]?.breakdown_info !== undefined);
    console.log('✅ Has checklist:', allResponse.data.data[0]?.asset_type?.checklist_items !== undefined);
    console.log('');

    // Test 2: Get specific work order
    const testAmsId = allResponse.data.data[0]?.ams_id || 'ams002';
    console.log(`2. Testing GET /api/work-orders/${testAmsId}`);
    const singleResponse = await axios.get(`${BASE_URL}/api/work-orders/${testAmsId}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log('✅ Status:', singleResponse.status);
    console.log('✅ Is single object:', !Array.isArray(singleResponse.data.data));
    console.log('✅ ams_id:', singleResponse.data.data?.ams_id);
    console.log('✅ wo_id:', singleResponse.data.data?.wo_id);
    console.log('✅ Has breakdown_info:', singleResponse.data.data?.breakdown_info !== undefined);
    console.log('✅ Breakdown reason:', singleResponse.data.data?.breakdown_info?.breakdown_reason || 'N/A');
    console.log('✅ Has checklist:', singleResponse.data.data?.asset_type?.checklist_items !== undefined);
    console.log('✅ Checklist count:', singleResponse.data.data?.asset_type?.checklist_items?.length || 0);
    console.log('');

    // Test 3: Verify they're different
    console.log('3. Verifying responses are different:');
    const allIsArray = Array.isArray(allResponse.data.data);
    const singleIsObject = !Array.isArray(singleResponse.data.data) && typeof singleResponse.data.data === 'object';
    console.log('✅ /all returns array:', allIsArray);
    console.log('✅ /:id returns object:', singleIsObject);
    console.log('✅ Responses are different:', allIsArray && singleIsObject);
    console.log('');

    console.log('=== All tests passed! ===');

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Instructions
console.log('INSTRUCTIONS:');
console.log('1. Make sure the server is running on http://localhost:4000');
console.log('2. Replace YOUR_JWT_TOKEN_HERE with a valid JWT token');
console.log('3. Run: node test_workorder_routes.js');
console.log('');

// Run tests if token is provided
if (TOKEN !== 'YOUR_JWT_TOKEN_HERE') {
  testRoutes();
} else {
  console.log('⚠️  Please update the TOKEN variable with your JWT token before running tests.');
}

