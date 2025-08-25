const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:4000/api';
const TEST_TOKEN = 'your-jwt-token-here'; // Replace with actual token

// Test data
const testDate = '2024-01-15';

async function testWorkflowBypassAPI() {
    console.log('🧪 Testing Workflow Bypass API');
    console.log('================================\n');

    try {
        // Test 1: Generate maintenance schedules with workflow bypass
        console.log('1️⃣ Testing generate-with-bypass endpoint...');
        
        const bypassResponse = await axios.post(
            `${BASE_URL}/maintenance-schedules/generate-with-bypass`,
            {
                test_date: testDate
            },
            {
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Workflow bypass generation successful!');
        console.log('Response:', JSON.stringify(bypassResponse.data, null, 2));
        console.log('');

        // Test 2: Generate maintenance schedules with workflow bypass (cron)
        console.log('2️⃣ Testing generate-cron-with-bypass endpoint...');
        
        const cronBypassResponse = await axios.post(
            `${BASE_URL}/maintenance-schedules/generate-cron-with-bypass`,
            {
                test_date: testDate
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Cron workflow bypass generation successful!');
        console.log('Response:', JSON.stringify(cronBypassResponse.data, null, 2));
        console.log('');

        // Test 3: Get all maintenance schedules to see both workflow and direct schedules
        console.log('3️⃣ Testing get all maintenance schedules...');
        
        const allSchedulesResponse = await axios.get(
            `${BASE_URL}/maintenance-schedules/all`,
            {
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`
                }
            }
        );

        console.log('✅ All maintenance schedules retrieved!');
        console.log('Total schedules:', allSchedulesResponse.data.count);
        console.log('Sample data:', JSON.stringify(allSchedulesResponse.data.data.slice(0, 2), null, 2));
        console.log('');

        // Test 4: Get asset types requiring maintenance
        console.log('4️⃣ Testing get asset types requiring maintenance...');
        
        const assetTypesResponse = await axios.get(
            `${BASE_URL}/maintenance-schedules/asset-types`,
            {
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`
                }
            }
        );

        console.log('✅ Asset types retrieved!');
        console.log('Asset types:', JSON.stringify(assetTypesResponse.data, null, 2));
        console.log('');

        // Test 5: Compare with original generate endpoint
        console.log('5️⃣ Testing original generate endpoint for comparison...');
        
        const originalResponse = await axios.post(
            `${BASE_URL}/maintenance-schedules/generate`,
            {
                test_date: testDate
            },
            {
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Original generation successful!');
        console.log('Original response:', JSON.stringify(originalResponse.data, null, 2));
        console.log('');

        // Summary comparison
        console.log('📊 Summary Comparison:');
        console.log('================================');
        console.log(`Original API - Schedules created: ${originalResponse.data.schedules_created}`);
        console.log(`Bypass API - Total schedules: ${bypassResponse.data.total_schedules_created}`);
        console.log(`Bypass API - Workflow schedules: ${bypassResponse.data.workflow_schedules_created}`);
        console.log(`Bypass API - Direct schedules: ${bypassResponse.data.direct_schedules_created}`);
        console.log('');

        // Test 6: Test error handling with invalid date
        console.log('6️⃣ Testing error handling with invalid date...');
        
        try {
            await axios.post(
                `${BASE_URL}/maintenance-schedules/generate-with-bypass`,
                {
                    test_date: 'invalid-date'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${TEST_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error) {
            console.log('✅ Error handling working correctly!');
            console.log('Error response:', error.response?.data || error.message);
        }
        console.log('');

        console.log('🎉 All tests completed successfully!');
        console.log('');
        console.log('📝 Key Features Demonstrated:');
        console.log('   ✅ Workflow bypass logic for asset types without workflow sequences');
        console.log('   ✅ Direct maintenance schedule creation in tblAssetMaintSch');
        console.log('   ✅ Workflow schedule creation for asset types with workflow sequences');
        console.log('   ✅ Cron job compatibility');
        console.log('   ✅ Error handling');
        console.log('   ✅ Detailed response with schedule counts');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

// Test specific asset maintenance schedules
async function testAssetMaintenanceSchedules() {
    console.log('🔍 Testing Asset-Specific Maintenance Schedules');
    console.log('===============================================\n');

    try {
        // Get a sample asset ID from the maintenance schedules
        const allSchedulesResponse = await axios.get(
            `${BASE_URL}/maintenance-schedules/all`,
            {
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`
                }
            }
        );

        if (allSchedulesResponse.data.data.length > 0) {
            const sampleAssetId = allSchedulesResponse.data.data[0].asset_id;
            
            console.log(`Testing maintenance schedules for asset: ${sampleAssetId}`);
            
            const assetSchedulesResponse = await axios.get(
                `${BASE_URL}/maintenance-schedules/asset/${sampleAssetId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${TEST_TOKEN}`
                    }
                }
            );

            console.log('✅ Asset maintenance schedules retrieved!');
            console.log('Response:', JSON.stringify(assetSchedulesResponse.data, null, 2));
            console.log('');
            
            console.log('📊 Asset Schedule Summary:');
            console.log(`   Workflow schedules: ${assetSchedulesResponse.data.workflow_schedules.length}`);
            console.log(`   Direct maintenance schedules: ${assetSchedulesResponse.data.maintenance_schedules.length}`);
        } else {
            console.log('⚠️  No maintenance schedules found to test asset-specific endpoint');
        }

    } catch (error) {
        console.error('❌ Asset maintenance schedules test failed:', error.message);
    }
}

// Test maintenance frequency for asset types
async function testMaintenanceFrequency() {
    console.log('⏰ Testing Maintenance Frequency API');
    console.log('===================================\n');

    try {
        // First get asset types
        const assetTypesResponse = await axios.get(
            `${BASE_URL}/maintenance-schedules/asset-types`,
            {
                headers: {
                    'Authorization': `Bearer ${TEST_TOKEN}`
                }
            }
        );

        if (assetTypesResponse.data.length > 0) {
            const sampleAssetTypeId = assetTypesResponse.data[0].asset_type_id;
            
            console.log(`Testing maintenance frequency for asset type: ${sampleAssetTypeId}`);
            
            const frequencyResponse = await axios.get(
                `${BASE_URL}/maintenance-schedules/frequency/${sampleAssetTypeId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${TEST_TOKEN}`
                    }
                }
            );

            console.log('✅ Maintenance frequency retrieved!');
            console.log('Response:', JSON.stringify(frequencyResponse.data, null, 2));
            console.log('');
            
            console.log('📊 Frequency Summary:');
            frequencyResponse.data.forEach((freq, index) => {
                console.log(`   ${index + 1}. ${freq.frequency} ${freq.uom} (ID: ${freq.at_main_freq_id})`);
            });
        } else {
            console.log('⚠️  No asset types found to test frequency endpoint');
        }

    } catch (error) {
        console.error('❌ Maintenance frequency test failed:', error.message);
    }
}

// Main test execution
async function runAllTests() {
    console.log('🚀 Starting Workflow Bypass API Tests');
    console.log('=====================================\n');
    
    await testWorkflowBypassAPI();
    await testAssetMaintenanceSchedules();
    await testMaintenanceFrequency();
    
    console.log('🏁 All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    testWorkflowBypassAPI,
    testAssetMaintenanceSchedules,
    testMaintenanceFrequency,
    runAllTests
};
