const db = require('./config/db');
const workflowNotificationService = require('./services/workflowNotificationService');
const fcmService = require('./services/fcmService');

/**
 * Test script for workflow notification system
 * This script tests the push notification functionality when new records are added to tblWFAssetMaintSch_D
 */

async function testWorkflowNotificationSystem() {
    console.log('🧪 Testing Workflow Notification System...\n');

    try {
        // Test 1: Check if FCM service is properly initialized
        console.log('1. Testing FCM Service Initialization...');
        console.log('FCM Service initialized:', fcmService.initialized);
        
        // Test 2: Check if we have users with job roles
        console.log('\n2. Checking users with job roles...');
        const usersWithRolesQuery = `
            SELECT 
                u.user_id,
                u.emp_int_id,
                u.full_name,
                ujr.job_role_id,
                jr.text as role_name
            FROM "tblUsers" u
            INNER JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
            INNER JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
            WHERE u.int_status = 1
            LIMIT 5
        `;
        const usersResult = await db.query(usersWithRolesQuery);
        console.log(`Found ${usersResult.rows.length} users with job roles:`);
        usersResult.rows.forEach(user => {
            console.log(`  - ${user.full_name} (${user.emp_int_id}) - Role: ${user.role_name}`);
        });

        // Test 3: Check if we have assets for testing
        console.log('\n3. Checking available assets...');
        const assetsQuery = `
            SELECT 
                asset_id,
                text as asset_name,
                asset_type_id,
                org_id
            FROM "tblAssets"
            WHERE current_status = 'Active'
            LIMIT 3
        `;
        const assetsResult = await db.query(assetsQuery);
        console.log(`Found ${assetsResult.rows.length} assets:`);
        assetsResult.rows.forEach(asset => {
            console.log(`  - ${asset.asset_id}: ${asset.asset_name}`);
        });

        // Test 4: Check notification preferences
        console.log('\n4. Checking notification preferences...');
        const preferencesQuery = `
            SELECT 
                np.user_id,
                np.notification_type,
                np.push_enabled,
                u.full_name
            FROM "tblNotificationPreferences" np
            INNER JOIN "tblUsers" u ON np.user_id = u.user_id
            WHERE np.notification_type IN ('workflow_approval', 'breakdown_approval')
            LIMIT 5
        `;
        const preferencesResult = await db.query(preferencesQuery);
        console.log(`Found ${preferencesResult.rows.length} notification preferences:`);
        preferencesResult.rows.forEach(pref => {
            console.log(`  - ${pref.full_name}: ${pref.notification_type} (push: ${pref.push_enabled})`);
        });

        // Test 5: Check FCM tokens
        console.log('\n5. Checking FCM device tokens...');
        const tokensQuery = `
            SELECT 
                ft.user_id,
                ft.device_type,
                ft.platform,
                ft.is_active,
                u.full_name
            FROM "tblFCMTokens" ft
            INNER JOIN "tblUsers" u ON ft.user_id = u.user_id
            WHERE ft.is_active = true
            LIMIT 5
        `;
        const tokensResult = await db.query(tokensQuery);
        console.log(`Found ${tokensResult.rows.length} active FCM tokens:`);
        tokensResult.rows.forEach(token => {
            console.log(`  - ${token.full_name}: ${token.platform} (${token.device_type})`);
        });

        // Test 6: Simulate a workflow notification
        if (usersResult.rows.length > 0 && assetsResult.rows.length > 0) {
            console.log('\n6. Testing workflow notification...');
            
            const testUser = usersResult.rows[0];
            const testAsset = assetsResult.rows[0];
            
            // Create a test workflow detail data
            const testDetailData = {
                wfamsd_id: 'TEST_WFAMSD_001',
                wfamsh_id: 'TEST_WFAMSH_001',
                job_role_id: testUser.job_role_id,
                status: 'AP', // Approval Pending
                sequence: 10,
                org_id: testAsset.org_id
            };

            console.log('Sending test notification for:', {
                asset: testAsset.asset_name,
                role: testUser.role_name,
                user: testUser.full_name
            });

            try {
                const notificationResult = await workflowNotificationService.notifyNewWorkflowDetail(testDetailData);
                console.log('✅ Notification test result:', {
                    success: notificationResult.success,
                    totalUsers: notificationResult.totalUsers,
                    successCount: notificationResult.successCount,
                    failureCount: notificationResult.failureCount
                });
            } catch (notificationError) {
                console.log('⚠️ Notification test failed (this is expected if Firebase is not configured):', notificationError.message);
            }
        }

        // Test 7: Test breakdown notification
        if (usersResult.rows.length > 0 && assetsResult.rows.length > 0) {
            console.log('\n7. Testing breakdown notification...');
            
            const testUser = usersResult.rows[0];
            const testAsset = assetsResult.rows[0];
            
            const testBreakdownDetailData = {
                wfamsd_id: 'TEST_BD_WFAMSD_001',
                wfamsh_id: 'TEST_BD_WFAMSH_001',
                job_role_id: testUser.job_role_id,
                status: 'AP',
                sequence: 10,
                org_id: testAsset.org_id
            };

            const breakdownInfo = 'BF01-Breakdown-TEST001-Urgent maintenance required';

            console.log('Sending test breakdown notification for:', {
                asset: testAsset.asset_name,
                role: testUser.role_name,
                breakdown: breakdownInfo
            });

            try {
                const breakdownResult = await workflowNotificationService.notifyBreakdownWorkflowDetail(
                    testBreakdownDetailData, 
                    breakdownInfo
                );
                console.log('✅ Breakdown notification test result:', {
                    success: breakdownResult.success,
                    totalUsers: breakdownResult.totalUsers,
                    successCount: breakdownResult.successCount,
                    failureCount: breakdownResult.failureCount
                });
            } catch (notificationError) {
                console.log('⚠️ Breakdown notification test failed (this is expected if Firebase is not configured):', notificationError.message);
            }
        }

        console.log('\n✅ Workflow notification system test completed!');
        console.log('\n📋 Summary:');
        console.log('- FCM Service:', fcmService.initialized ? '✅ Initialized' : '❌ Not initialized');
        console.log('- Users with roles:', usersResult.rows.length > 0 ? '✅ Found' : '❌ None found');
        console.log('- Assets available:', assetsResult.rows.length > 0 ? '✅ Found' : '❌ None found');
        console.log('- Notification preferences:', preferencesResult.rows.length > 0 ? '✅ Found' : '❌ None found');
        console.log('- FCM tokens:', tokensResult.rows.length > 0 ? '✅ Found' : '❌ None found');

        if (tokensResult.rows.length === 0) {
            console.log('\n💡 To test push notifications:');
            console.log('1. Register device tokens using the mobile app');
            console.log('2. Configure Firebase credentials in environment variables');
            console.log('3. Run this test again');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Close database connection
        await db.end();
    }
}

// Run the test
if (require.main === module) {
    testWorkflowNotificationSystem();
}

module.exports = { testWorkflowNotificationSystem };
