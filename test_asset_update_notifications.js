#!/usr/bin/env node

/**
 * Test script for Asset Update Notifications
 * 
 * This script tests the asset update notification flow to ensure
 * that mobile apps receive notifications when assets are updated.
 */

const db = require('./config/db');
const notificationService = require('./services/notificationIntegrationService');
const assetAssignmentModel = require('./models/assetAssignmentModel');

async function testAssetUpdateNotifications() {
    console.log('🧪 Testing Asset Update Notifications...\n');

    try {
        // 1. Get a test asset with an assignment
        console.log('1️⃣ Finding test asset with assignment...');
        const testAssetQuery = `
            SELECT 
                a.asset_id, a.text as asset_name, a.org_id,
                aa.employee_int_id, e.employee_id, u.user_id, u.full_name
            FROM "tblAssets" a
            LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id 
                AND aa.action = 'A' AND aa.latest_assignment_flag = true
            LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
            LEFT JOIN "tblUsers" u ON e.employee_id = u.emp_int_id
            WHERE a.current_status = 'Active' AND u.user_id IS NOT NULL
            LIMIT 1
        `;
        
        const assetResult = await db.query(testAssetQuery);
        
        if (assetResult.rows.length === 0) {
            console.log('❌ No test asset with assignment found. Please create an asset assignment first.');
            return;
        }
        
        const testAsset = assetResult.rows[0];
        console.log(`✅ Found test asset: ${testAsset.asset_name} (ID: ${testAsset.asset_id})`);
        console.log(`   Assigned to: ${testAsset.full_name} (User ID: ${testAsset.user_id})`);

        // 2. Test the getLatestAssetAssignment method
        console.log('\n2️⃣ Testing getLatestAssetAssignment method...');
        const assignmentInfo = await assetAssignmentModel.getLatestAssetAssignment(testAsset.asset_id);
        
        if (assignmentInfo.rows.length === 0) {
            console.log('❌ No assignment found for this asset');
            return;
        }
        
        const assignment = assignmentInfo.rows[0];
        console.log(`✅ Assignment found: ${assignment.employee_name} (User ID: ${assignment.employee_user_id})`);

        // 3. Test notification service directly
        console.log('\n3️⃣ Testing notification service...');
        const assetData = {
            assetId: testAsset.asset_id,
            assetName: testAsset.asset_name,
            assignedTo: assignment.employee_user_id
        };
        
        const changes = {
            updatedBy: 'TEST_USER',
            updatedAt: new Date().toISOString(),
            fields: ['description', 'current_status']
        };
        
        console.log('📱 Sending test notification...');
        const notificationResult = await notificationService.notifyAssetUpdated(
            assetData, 
            assignment.employee_user_id, 
            changes
        );
        
        if (notificationResult) {
            console.log('✅ Notification sent successfully!');
            console.log(`   Result:`, notificationResult);
        } else {
            console.log('❌ Notification failed');
        }

        // 4. Check notification history
        console.log('\n4️⃣ Checking notification history...');
        const historyQuery = `
            SELECT 
                notification_id, user_id, notification_type, title, body, 
                status, sent_on, fcm_response
            FROM "tblNotificationHistory" 
            WHERE user_id = $1 AND notification_type = 'asset_updated'
            ORDER BY sent_on DESC 
            LIMIT 5
        `;
        
        const historyResult = await db.query(historyQuery, [assignment.employee_user_id]);
        
        if (historyResult.rows.length > 0) {
            console.log('✅ Notification history found:');
            historyResult.rows.forEach((record, index) => {
                console.log(`   ${index + 1}. ${record.title} - ${record.status} (${record.sent_on})`);
            });
        } else {
            console.log('⚠️  No notification history found');
        }

        // 5. Check user's notification preferences
        console.log('\n5️⃣ Checking user notification preferences...');
        const preferencesQuery = `
            SELECT notification_type, is_enabled, push_enabled, email_enabled
            FROM "tblNotificationPreferences" 
            WHERE user_id = $1 AND notification_type = 'asset_updated'
        `;
        
        const preferencesResult = await db.query(preferencesQuery, [assignment.employee_user_id]);
        
        if (preferencesResult.rows.length > 0) {
            const pref = preferencesResult.rows[0];
            console.log(`✅ User preferences: enabled=${pref.is_enabled}, push=${pref.push_enabled}, email=${pref.email_enabled}`);
        } else {
            console.log('⚠️  No notification preferences found for user');
        }

        // 6. Check FCM tokens
        console.log('\n6️⃣ Checking FCM tokens...');
        const tokensQuery = `
            SELECT device_token, platform, device_type, is_active, last_used
            FROM "tblFCMTokens" 
            WHERE user_id = $1 AND is_active = true
        `;
        
        const tokensResult = await db.query(tokensQuery, [assignment.employee_user_id]);
        
        if (tokensResult.rows.length > 0) {
            console.log(`✅ Found ${tokensResult.rows.length} active FCM token(s):`);
            tokensResult.rows.forEach((token, index) => {
                console.log(`   ${index + 1}. ${token.platform} - ${token.device_type} (${token.is_active ? 'active' : 'inactive'})`);
            });
        } else {
            console.log('❌ No active FCM tokens found for user');
            console.log('   This is why notifications might not be received!');
        }

        console.log('\n🎉 Asset update notification test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await db.end();
    }
}

// Run the test
if (require.main === module) {
    testAssetUpdateNotifications().catch(console.error);
}

module.exports = { testAssetUpdateNotifications };
