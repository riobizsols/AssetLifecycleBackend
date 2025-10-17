/**
 * Test Breakdown Info Fix
 * Verifies that breakdown_info is properly fetched from tblAssetBRDet
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:4000';
const TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

async function testBreakdownInfo() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       TESTING BREAKDOWN INFO FIX');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // Test 1: Check if breakdowns exist in database
    console.log('📋 TEST 1: Check Database for Breakdowns');
    console.log('─────────────────────────────────────────────────────');
    
    // You can run this SQL manually to check:
    console.log('Run this SQL to check breakdowns:');
    console.log(`
    SELECT 
      brd.abr_id,
      brd.asset_id,
      brd.decision_code,
      brd.description,
      brc.text as breakdown_reason,
      brd.created_on
    FROM "tblAssetBRDet" brd
    LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
    WHERE brd.org_id = 'ORG001'
      AND brd.decision_code IN ('BF01', 'BF02', 'BF03')
    ORDER BY brd.created_on DESC
    LIMIT 5;
    `);
    console.log('');

    // Test 2: Get all work orders and check breakdown_info
    console.log('📋 TEST 2: Check Breakdown Info in All Work Orders');
    console.log('─────────────────────────────────────────────────────');
    
    const allResponse = await axios.get(`${BASE_URL}/api/work-orders/all`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    
    console.log('✅ Status:', allResponse.status);
    console.log('✅ Total work orders:', allResponse.data.count);
    
    if (allResponse.data.count > 0) {
      const workOrders = allResponse.data.data;
      let breakdownCount = 0;
      
      workOrders.forEach((wo, index) => {
        if (wo.breakdown_info && wo.breakdown_info.abr_id) {
          breakdownCount++;
          console.log(`✅ Work Order ${index + 1} (${wo.ams_id}):`);
          console.log(`   - ABR ID: ${wo.breakdown_info.abr_id}`);
          console.log(`   - Reason: ${wo.breakdown_info.breakdown_reason}`);
          console.log(`   - Decision: ${wo.breakdown_info.decision_code}`);
          console.log(`   - WO ID: ${wo.wo_id}`);
          console.log('');
        }
      });
      
      console.log(`✅ Work orders with breakdown info: ${breakdownCount}/${workOrders.length}`);
    }
    console.log('');

    // Test 3: Test specific work order (ams002)
    console.log('📋 TEST 3: Check Specific Work Order (ams002)');
    console.log('─────────────────────────────────────────────────────');
    
    try {
      const singleResponse = await axios.get(`${BASE_URL}/api/work-orders/ams002`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      
      console.log('✅ Status:', singleResponse.status);
      const workOrder = singleResponse.data.data;
      
      console.log('✅ Work Order ID:', workOrder.ams_id);
      console.log('✅ WO ID:', workOrder.wo_id);
      console.log('✅ Asset ID:', workOrder.asset.asset_id);
      console.log('✅ Maintenance Type:', workOrder.maint_type_id);
      
      if (workOrder.breakdown_info && workOrder.breakdown_info.abr_id) {
        console.log('✅ BREAKDOWN INFO FOUND:');
        console.log('   - ABR ID:', workOrder.breakdown_info.abr_id);
        console.log('   - Reason Code:', workOrder.breakdown_info.breakdown_reason_code);
        console.log('   - Reason:', workOrder.breakdown_info.breakdown_reason);
        console.log('   - Description:', workOrder.breakdown_info.breakdown_description);
        console.log('   - Decision Code:', workOrder.breakdown_info.decision_code);
        console.log('   - Reported By:', workOrder.breakdown_info.reported_by);
        console.log('   - Reported On:', workOrder.breakdown_info.reported_on);
      } else {
        console.log('⚠️  BREAKDOWN INFO IS NULL');
        console.log('   This could mean:');
        console.log('   1. No breakdown exists for this asset');
        console.log('   2. Asset has no breakdowns with BF01/BF02/BF03');
        console.log('   3. Maintenance type is not MT004');
      }
      
    } catch (error) {
      console.log('❌ Error fetching ams002:', error.response?.data?.message || error.message);
    }
    console.log('');

    // Test 4: Debug query for ams002
    console.log('📋 TEST 4: Debug Query for ams002');
    console.log('─────────────────────────────────────────────────────');
    console.log('Run this SQL to debug ams002 breakdown info:');
    console.log(`
    SELECT 
      ams.ams_id,
      ams.wo_id,
      ams.asset_id,
      ams.maint_type_id,
      ams.wfamsh_id,
      brd.abr_id,
      brd.decision_code,
      brd.description as breakdown_description,
      brc.text as breakdown_reason
    FROM "tblAssetMaintSch" ams
    LEFT JOIN "tblAssetBRDet" brd ON brd.asset_id = ams.asset_id
      AND brd.org_id = ams.org_id
      AND brd.decision_code IN ('BF01', 'BF02', 'BF03')
    LEFT JOIN "tblATBRReasonCodes" brc ON brd.atbrrc_id = brc.atbrrc_id
    WHERE ams.ams_id = 'ams002'
      AND ams.org_id = 'ORG001'
    ORDER BY brd.created_on DESC;
    `);
    console.log('');

    console.log('═══════════════════════════════════════════════════════');
    console.log('                    SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Breakdown info query has been updated');
    console.log('✅ Now uses multiple methods to find breakdown:');
    console.log('   1. Match by wo_id containing abr_id');
    console.log('   2. Match by workflow notes containing abr_id');
    console.log('   3. For MT004 maintenance, get most recent breakdown');
    console.log('');
    console.log('Next Steps:');
    console.log('1. Restart server');
    console.log('2. Test API again');
    console.log('3. Check database for breakdowns');
    console.log('4. Verify breakdown_info is no longer null');
    console.log('');

  } catch (error) {
    console.error('❌ Unexpected error:', error.response?.data || error.message);
  }
}

// Instructions
if (TOKEN === 'YOUR_JWT_TOKEN_HERE') {
  console.log('⚠️  SETUP REQUIRED');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('Please update TOKEN variable with your JWT token');
  console.log('Then run: node test_breakdown_info.js\n');
} else {
  testBreakdownInfo();
}
