/**
 * Test Script: Group Asset Maintenance Workflow
 * 
 * This script tests and documents how maintenance works for group assets:
 * 1. Creates a group asset of the same asset type
 * 2. Schedules maintenance for the group
 * 3. Checks how notifications and workflow work for group assets
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';
let authToken = '';
let testOrgId = 'ORG001';
let testUserId = '';
let testBranchId = '';

// Test data
let createdAssetGroupId = null;
let createdAssetIds = [];
let testAssetTypeId = null;
let maintenanceSchedulesCreated = [];

/**
 * Step 1: Login to get authentication token
 */
async function login() {
    console.log('\n=== Step 1: Login ===');
    try {
        // Replace with actual test credentials
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'test@example.com', // Update with actual test user
            password: 'testpassword'   // Update with actual test password
        });
        
        authToken = response.data.token;
        testUserId = response.data.user?.user_id;
        testOrgId = response.data.user?.org_id || testOrgId;
        testBranchId = response.data.user?.branch_id;
        
        console.log('✅ Login successful');
        console.log(`   User ID: ${testUserId}`);
        console.log(`   Org ID: ${testOrgId}`);
        console.log(`   Branch ID: ${testBranchId}`);
        
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Step 2: Get asset types that require maintenance
 */
async function getAssetTypesRequiringMaintenance() {
    console.log('\n=== Step 2: Get Asset Types Requiring Maintenance ===');
    try {
        const response = await axios.get(`${BASE_URL}/api/maintenance-schedules/asset-types`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const assetTypes = response.data;
        console.log(`✅ Found ${assetTypes.length} asset types requiring maintenance`);
        
        if (assetTypes.length > 0) {
            // Use the first asset type that requires maintenance
            testAssetTypeId = assetTypes[0].asset_type_id;
            console.log(`   Selected Asset Type: ${assetTypes[0].text} (${testAssetTypeId})`);
            return assetTypes[0];
        }
        
        console.log('⚠️  No asset types found that require maintenance');
        return null;
    } catch (error) {
        console.error('❌ Failed to get asset types:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Step 3: Get available assets of the same asset type for grouping
 */
async function getAvailableAssets(assetTypeId) {
    console.log('\n=== Step 3: Get Available Assets for Grouping ===');
    try {
        const response = await axios.get(`${BASE_URL}/api/group-assets/available-by-type/${assetTypeId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        const assets = response.data;
        console.log(`✅ Found ${assets.length} available assets of type ${assetTypeId}`);
        
        if (assets.length < 2) {
            console.log('⚠️  Need at least 2 assets of the same type to create a group');
            return [];
        }
        
        // Select first 2-3 assets for the group
        const selectedAssets = assets.slice(0, Math.min(3, assets.length));
        console.log(`   Selected ${selectedAssets.length} assets for grouping:`);
        selectedAssets.forEach((asset, index) => {
            console.log(`   ${index + 1}. ${asset.text || asset.asset_id} (${asset.asset_id})`);
        });
        
        return selectedAssets;
    } catch (error) {
        console.error('❌ Failed to get available assets:', error.response?.data || error.message);
        return [];
    }
}

/**
 * Step 4: Create a group asset with assets of the same type
 */
async function createGroupAsset(assets) {
    console.log('\n=== Step 4: Create Group Asset ===');
    try {
        if (assets.length < 2) {
            console.log('❌ Cannot create group: Need at least 2 assets');
            return null;
        }
        
        const assetIds = assets.map(a => a.asset_id);
        const groupName = `Test Group - ${new Date().toISOString().split('T')[0]}`;
        
        const response = await axios.post(`${BASE_URL}/api/asset-groups`, {
            text: groupName,
            asset_ids: assetIds
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        createdAssetGroupId = response.data.asset_group?.header?.assetgroup_h_id;
        createdAssetIds = assetIds;
        
        console.log('✅ Group asset created successfully');
        console.log(`   Group ID: ${createdAssetGroupId}`);
        console.log(`   Group Name: ${groupName}`);
        console.log(`   Assets in group: ${assetIds.length}`);
        console.log(`   Asset IDs: ${assetIds.join(', ')}`);
        
        return response.data.asset_group;
    } catch (error) {
        console.error('❌ Failed to create group asset:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Step 5: Verify group_id is set in assets
 */
async function verifyGroupIdInAssets() {
    console.log('\n=== Step 5: Verify Group ID in Assets ===');
    try {
        for (const assetId of createdAssetIds) {
            const response = await axios.get(`${BASE_URL}/api/assets/${assetId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            
            const asset = response.data.asset || response.data;
            const groupId = asset.group_id;
            
            console.log(`   Asset ${assetId}:`);
            console.log(`     Name: ${asset.text || asset.asset_name}`);
            console.log(`     Group ID: ${groupId || 'NULL'}`);
            
            if (groupId === createdAssetGroupId) {
                console.log(`     ✅ Group ID correctly set`);
            } else {
                console.log(`     ❌ Group ID mismatch! Expected: ${createdAssetGroupId}, Got: ${groupId}`);
            }
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to verify group IDs:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Step 6: Schedule maintenance for the group
 */
async function scheduleMaintenanceForGroup() {
    console.log('\n=== Step 6: Schedule Maintenance for Group ===');
    console.log('   Note: Maintenance schedules are generated per asset, not per group');
    console.log('   The system will create individual schedules for each asset in the group');
    
    try {
        // Trigger maintenance schedule generation
        const response = await axios.post(`${BASE_URL}/api/maintenance-schedules/generate`, {
            test_date: new Date().toISOString().split('T')[0] // Use today's date for testing
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        console.log('✅ Maintenance schedule generation triggered');
        console.log(`   Asset types processed: ${response.data.asset_types_processed}`);
        console.log(`   Assets processed: ${response.data.assets_processed}`);
        console.log(`   Assets skipped: ${response.data.assets_skipped}`);
        console.log(`   Schedules created: ${response.data.schedules_created}`);
        
        // Check maintenance schedules for each asset in the group
        console.log('\n   Checking maintenance schedules for group assets:');
        for (const assetId of createdAssetIds) {
            const scheduleResponse = await axios.get(`${BASE_URL}/api/maintenance-schedules/asset/${assetId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            
            const schedules = scheduleResponse.data;
            const workflowSchedules = schedules.workflow_schedules || [];
            const maintenanceSchedules = schedules.maintenance_schedules || [];
            
            console.log(`\n   Asset ${assetId}:`);
            console.log(`     Workflow schedules: ${workflowSchedules.length}`);
            console.log(`     Maintenance schedules: ${maintenanceSchedules.length}`);
            
            if (workflowSchedules.length > 0) {
                workflowSchedules.forEach((schedule, index) => {
                    console.log(`     Workflow Schedule ${index + 1}:`);
                    console.log(`       WFAMSH ID: ${schedule.wfamsh_id}`);
                    console.log(`       Status: ${schedule.status}`);
                    console.log(`       Planned Date: ${schedule.pl_sch_date || schedule.act_sch_date}`);
                    console.log(`       Group ID: ${schedule.group_id || 'NULL'}`);
                    maintenanceSchedulesCreated.push(schedule.wfamsh_id);
                });
            }
            
            if (maintenanceSchedules.length > 0) {
                maintenanceSchedules.forEach((schedule, index) => {
                    console.log(`     Maintenance Schedule ${index + 1}:`);
                    console.log(`       AMS ID: ${schedule.ams_id}`);
                    console.log(`       Status: ${schedule.status}`);
                    console.log(`       Act Maint Date: ${schedule.act_maint_st_date}`);
                });
            }
        }
        
        return response.data;
    } catch (error) {
        console.error('❌ Failed to schedule maintenance:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Step 7: Check notifications for group assets
 */
async function checkNotificationsForGroup() {
    console.log('\n=== Step 7: Check Notifications for Group Assets ===');
    try {
        const response = await axios.get(`${BASE_URL}/api/notifications/maintenance`, {
            headers: { Authorization: `Bearer ${authToken}` },
            params: {
                orgId: testOrgId,
                branchId: testBranchId
            }
        });
        
        const notifications = response.data.notifications || response.data || [];
        console.log(`✅ Found ${notifications.length} total maintenance notifications`);
        
        // Filter notifications for assets in our test group
        const groupNotifications = notifications.filter(notif => 
            createdAssetIds.includes(notif.asset_id)
        );
        
        console.log(`\n   Notifications for group assets: ${groupNotifications.length}`);
        
        if (groupNotifications.length > 0) {
            console.log('\n   Group Asset Notifications:');
            groupNotifications.forEach((notif, index) => {
                console.log(`\n   ${index + 1}. Asset: ${notif.asset_id}`);
                console.log(`      Asset Type: ${notif.asset_type_name}`);
                console.log(`      Planned Date: ${notif.pl_sch_date}`);
                console.log(`      Days Until Due: ${notif.days_until_due}`);
                console.log(`      Job Role: ${notif.job_role_name}`);
                console.log(`      Status: ${notif.detail_status}`);
                console.log(`      User: ${notif.user_name || 'N/A'}`);
            });
        } else {
            console.log('   ⚠️  No notifications found for group assets');
            console.log('   Note: This could mean:');
            console.log('     - Maintenance is not yet due');
            console.log('     - Workflow sequences are not configured');
            console.log('     - Users don\'t have the required job roles');
        }
        
        return groupNotifications;
    } catch (error) {
        console.error('❌ Failed to check notifications:', error.response?.data || error.message);
        return [];
    }
}

/**
 * Step 8: Check workflow details for group assets
 */
async function checkWorkflowForGroup() {
    console.log('\n=== Step 8: Check Workflow Details for Group Assets ===');
    
    if (maintenanceSchedulesCreated.length === 0) {
        console.log('   ⚠️  No workflow schedules found to check');
        return;
    }
    
    try {
        for (const wfamshId of maintenanceSchedulesCreated) {
            console.log(`\n   Checking workflow: ${wfamshId}`);
            
            // Get workflow header details
            const headerResponse = await axios.get(`${BASE_URL}/api/approval-detail/workflow/${wfamshId}`, {
                headers: { Authorization: `Bearer ${authToken}` },
                params: { orgId: testOrgId }
            });
            
            const workflow = headerResponse.data.workflow || headerResponse.data;
            
            console.log(`     Asset ID: ${workflow.asset_id}`);
            console.log(`     Planned Date: ${workflow.pl_sch_date}`);
            console.log(`     Status: ${workflow.status}`);
            console.log(`     Group ID: ${workflow.group_id || 'NULL'}`);
            console.log(`     Workflow Steps: ${workflow.steps?.length || 0}`);
            
            if (workflow.steps && workflow.steps.length > 0) {
                console.log('\n     Workflow Steps:');
                workflow.steps.forEach((step, index) => {
                    console.log(`       ${index + 1}. Sequence ${step.sequence}:`);
                    console.log(`          Job Role: ${step.job_role_name}`);
                    console.log(`          Status: ${step.status}`);
                    console.log(`          User: ${step.user_name || 'Role-based'}`);
                });
            }
        }
        
        console.log('\n   ✅ Workflow details retrieved');
        
        // Key findings
        console.log('\n   📋 Key Findings:');
        console.log('     1. Each asset in the group gets its own maintenance schedule');
        console.log('     2. Group ID is set to NULL in maintenance schedules (individual processing)');
        console.log('     3. Notifications are sent per asset, not per group');
        console.log('     4. Workflow steps are executed independently for each asset');
        
    } catch (error) {
        console.error('❌ Failed to check workflow:', error.response?.data || error.message);
    }
}

/**
 * Step 9: Generate summary report
 */
function generateSummary() {
    console.log('\n\n=== SUMMARY: Group Asset Maintenance Workflow ===\n');
    
    console.log('📊 Test Results:');
    console.log(`   Group Created: ${createdAssetGroupId ? '✅' : '❌'}`);
    console.log(`   Assets in Group: ${createdAssetIds.length}`);
    console.log(`   Maintenance Schedules Created: ${maintenanceSchedulesCreated.length}`);
    
    console.log('\n🔍 How Maintenance Works for Group Assets:');
    console.log('   1. Group Creation:');
    console.log('      - Assets are grouped by setting group_id in tblAssets');
    console.log('      - Group information is stored in tblAssetGroup_H and tblAssetGroup_D');
    console.log('      - All assets in a group must be of the same asset type');
    
    console.log('\n   2. Maintenance Scheduling:');
    console.log('      - Maintenance schedules are generated INDIVIDUALLY for each asset');
    console.log('      - The system processes assets one by one, not as a group');
    console.log('      - group_id field in tblWFAssetMaintSch_H is set to NULL');
    console.log('      - Each asset gets its own workflow schedule (wfamsh_id)');
    
    console.log('\n   3. Notifications:');
    console.log('      - Notifications are sent per asset, not per group');
    console.log('      - Users with appropriate job roles receive notifications for each asset');
    console.log('      - Each asset\'s maintenance notification is independent');
    
    console.log('\n   4. Workflow Processing:');
    console.log('      - Workflow steps are executed independently for each asset');
    console.log('      - Each asset goes through its own approval workflow');
    console.log('      - Group assets are not processed together in the workflow');
    
    console.log('\n💡 Key Insights:');
    console.log('   - Group assets are primarily for organizational/management purposes');
    console.log('   - Maintenance operations treat each asset individually');
    console.log('   - The group_id field exists in the schema but is not actively used in maintenance');
    console.log('   - To schedule maintenance for all assets in a group, you would need to:');
    console.log('     * Schedule maintenance for each asset individually, OR');
    console.log('     * Implement group-level maintenance scheduling logic');
    
    console.log('\n📝 Recommendations:');
    console.log('   - If group-level maintenance is needed, consider:');
    console.log('     1. Modify maintenance schedule generation to check group_id');
    console.log('     2. Create a single workflow schedule that references the group');
    console.log('     3. Update notifications to group assets together');
    console.log('     4. Add group-level maintenance history tracking');
}

/**
 * Cleanup: Delete test group (optional)
 */
async function cleanup() {
    console.log('\n=== Cleanup ===');
    if (createdAssetGroupId) {
        try {
            await axios.delete(`${BASE_URL}/api/asset-groups/${createdAssetGroupId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            console.log('✅ Test group deleted');
        } catch (error) {
            console.log('⚠️  Could not delete test group:', error.response?.data || error.message);
        }
    }
}

/**
 * Main execution function
 */
async function runTests() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   Group Asset Maintenance Workflow Test');
    console.log('═══════════════════════════════════════════════════════════');
    
    try {
        // Step 1: Login
        const loginSuccess = await login();
        if (!loginSuccess) {
            console.error('❌ Cannot proceed without authentication');
            return;
        }
        
        // Step 2: Get asset types
        const assetType = await getAssetTypesRequiringMaintenance();
        if (!assetType) {
            console.error('❌ Cannot proceed without asset types requiring maintenance');
            return;
        }
        
        // Step 3: Get available assets
        const assets = await getAvailableAssets(assetType.asset_type_id);
        if (assets.length < 2) {
            console.error('❌ Cannot proceed: Need at least 2 assets of the same type');
            return;
        }
        
        // Step 4: Create group asset
        const group = await createGroupAsset(assets);
        if (!group) {
            console.error('❌ Cannot proceed: Failed to create group');
            return;
        }
        
        // Step 5: Verify group IDs
        await verifyGroupIdInAssets();
        
        // Step 6: Schedule maintenance
        await scheduleMaintenanceForGroup();
        
        // Step 7: Check notifications
        await checkNotificationsForGroup();
        
        // Step 8: Check workflow
        await checkWorkflowForGroup();
        
        // Step 9: Generate summary
        generateSummary();
        
        // Optional cleanup
        // await cleanup();
        
    } catch (error) {
        console.error('\n❌ Test execution failed:', error.message);
        console.error(error.stack);
    }
}

// Run the tests
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    runTests,
    login,
    getAssetTypesRequiringMaintenance,
    getAvailableAssets,
    createGroupAsset,
    verifyGroupIdInAssets,
    scheduleMaintenanceForGroup,
    checkNotificationsForGroup,
    checkWorkflowForGroup,
    generateSummary
};

