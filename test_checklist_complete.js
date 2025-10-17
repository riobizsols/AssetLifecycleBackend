/**
 * Complete Checklist Testing Script
 * Tests checklist through the entire BF01 breakdown workflow
 * 
 * Run with: node test_checklist_complete.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:4000';
const TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

// Test data - update with your actual IDs
const TEST_DATA = {
  asset_id: 'ASSET001',
  asset_type_id: 'ATYPE001',
  atbrrc_id: 'ATBRRC_001', // Breakdown reason code
  reported_by: 'USER001',
  ams_id: 'ams002' // Work order to test
};

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testChecklist() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       CHECKLIST TESTING - COMPLETE WORKFLOW');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Test 1: Check if checklist exists for asset type
    console.log('📋 TEST 1: Verify Checklist Exists');
    console.log('─────────────────────────────────────────────────────');
    try {
      const checklistResponse = await api.get(`/api/checklist/asset-type/${TEST_DATA.asset_type_id}`);
      console.log('✅ Status:', checklistResponse.status);
      console.log('✅ Checklist items found:', checklistResponse.data.count);
      
      if (checklistResponse.data.count > 0) {
        console.log('\n📝 Checklist Items:');
        checklistResponse.data.data.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.text}`);
        });
      } else {
        console.log('⚠️  No checklist items found for this asset type!');
        console.log('   You need to add checklist items first.');
      }
    } catch (error) {
      console.log('❌ Error fetching checklist:', error.response?.data?.message || error.message);
    }
    console.log('\n');

    // Test 2: Get checklist by asset ID
    console.log('📋 TEST 2: Get Checklist by Asset ID');
    console.log('─────────────────────────────────────────────────────');
    try {
      const assetChecklistResponse = await api.get(`/api/checklist/asset/${TEST_DATA.asset_id}`);
      console.log('✅ Status:', assetChecklistResponse.status);
      console.log('✅ Checklist items:', assetChecklistResponse.data.count);
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    console.log('\n');

    // Test 3: Check work order includes checklist
    console.log('📋 TEST 3: Verify Checklist in Work Order');
    console.log('─────────────────────────────────────────────────────');
    try {
      const workOrderResponse = await api.get(`/api/work-orders/${TEST_DATA.ams_id}`);
      console.log('✅ Status:', workOrderResponse.status);
      console.log('✅ Work Order ID:', workOrderResponse.data.data.ams_id);
      console.log('✅ WO ID:', workOrderResponse.data.data.wo_id);
      
      const checklist = workOrderResponse.data.data.asset_type?.checklist_items;
      
      if (checklist && checklist.length > 0) {
        console.log('✅ Checklist included:', checklist.length, 'items');
        console.log('\n📝 Work Order Checklist:');
        checklist.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.text}`);
        });
      } else {
        console.log('⚠️  No checklist in work order response!');
        console.log('   Checklist value:', checklist);
      }

      // Check breakdown info
      const breakdownInfo = workOrderResponse.data.data.breakdown_info;
      if (breakdownInfo) {
        console.log('\n🔧 Breakdown Information:');
        console.log('   Reason:', breakdownInfo.breakdown_reason);
        console.log('   Description:', breakdownInfo.breakdown_description);
        console.log('   ABR ID:', breakdownInfo.abr_id);
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    console.log('\n');

    // Test 4: Get all work orders and check first one
    console.log('📋 TEST 4: Verify Checklist in All Work Orders');
    console.log('─────────────────────────────────────────────────────');
    try {
      const allWorkOrdersResponse = await api.get('/api/work-orders/all');
      console.log('✅ Status:', allWorkOrdersResponse.status);
      console.log('✅ Total work orders:', allWorkOrdersResponse.data.count);
      
      if (allWorkOrdersResponse.data.count > 0) {
        const firstWO = allWorkOrdersResponse.data.data[0];
        const checklist = firstWO.asset_type?.checklist_items;
        
        console.log('✅ First work order:', firstWO.ams_id);
        console.log('✅ Has checklist:', checklist && checklist.length > 0);
        
        if (checklist && checklist.length > 0) {
          console.log('✅ Checklist items:', checklist.length);
          console.log('   First item:', checklist[0].text);
        }
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }
    console.log('\n');

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('                    TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ All tests completed!');
    console.log('\nNext Steps:');
    console.log('1. If checklist is empty, add items to tblATMaintCheckList');
    console.log('2. If work order doesn\'t show checklist, restart server');
    console.log('3. Create new BF01 breakdown and verify checklist appears');
    console.log('4. Check frontend to see if checklist displays properly');
    console.log('\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Instructions
if (TOKEN === 'YOUR_JWT_TOKEN_HERE') {
  console.log('⚠️  SETUP REQUIRED');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Please update the following in this file:');
  console.log('1. TOKEN - Your JWT authentication token');
  console.log('2. TEST_DATA.asset_id - A valid asset ID');
  console.log('3. TEST_DATA.asset_type_id - The asset type ID');
  console.log('4. TEST_DATA.ams_id - A valid work order ID');
  console.log('\nThen run: node test_checklist_complete.js\n');
} else {
  testChecklist();
}

