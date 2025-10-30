#!/usr/bin/env node

/**
 * Debug script for Asset Update Notifications
 * 
 * This script checks why USR002 didn't receive notification for ASS002
 */

const db = require('./config/db');

async function debugAssetNotification() {
    console.log('🔍 Debugging Asset Update Notification for ASS002 → USR002...\n');

    try {
        // 1. Check if ASS002 exists and get its details
        console.log('1️⃣ Checking asset ASS002...');
        const assetQuery = `
            SELECT 
                a.asset_id, a.text as asset_name, a.current_status, a.org_id,
                a.created_on, a.changed_on
            FROM "tblAssets" a
            WHERE a.asset_id = 'ASS002'
        `;
        
        const assetResult = await db.query(assetQuery);
        
        if (assetResult.rows.length === 0) {
            console.log('❌ Asset ASS002 not found!');
            return;
        }
        
        const asset = assetResult.rows[0];
        console.log(`✅ Asset found: ${asset.asset_name} (Status: ${asset.current_status})`);
        console.log(`   Last changed: ${asset.changed_on}`);

        // 2. Check if USR002 exists
        console.log('\n2️⃣ Checking user USR002...');
        const userQuery = `
            SELECT 
                u.user_id, u.full_name, u.email, u.emp_int_id, u.int_status
            FROM "tblUsers" u
            WHERE u.user_id = 'USR002'
        `;
        
        const userResult = await db.query(userQuery);
        
        if (userResult.rows.length === 0) {
            console.log('❌ User USR002 not found!');
            return;
        }
        
        const user = userResult.rows[0];
        console.log(`✅ User found: ${user.full_name} (Email: ${user.email})`);
        console.log(`   Employee ID: ${user.emp_int_id}, Status: ${user.int_status}`);

        // 3. Check asset assignment for ASS002
        console.log('\n3️⃣ Checking asset assignment for ASS002...');
        const assignmentQuery = `
            SELECT 
                aa.asset_assign_id, aa.asset_id, aa.employee_int_id, aa.action, 
                aa.latest_assignment_flag, aa.action_on, aa.action_by,
                e.employee_id, e.name as employee_name,
                u.user_id as assigned_user_id, u.full_name as assigned_user_name
            FROM "tblAssetAssignments" aa
            LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
            LEFT JOIN "tblUsers" u ON e.employee_id = u.emp_int_id
            WHERE aa.asset_id = 'ASS002'
            ORDER BY aa.action_on DESC
        `;
        
        const assignmentResult = await db.query(assignmentQuery);
        
        if (assignmentResult.rows.length === 0) {
            console.log('❌ No asset assignments found for ASS002!');
            console.log('   This is why no notification was sent.');
            return;
        }
        
        console.log(`✅ Found ${assignmentResult.rows.length} assignment(s) for ASS002:`);
        assignmentResult.rows.forEach((assignment, index) => {
            console.log(`   ${index + 1}. Employee: ${assignment.employee_name || 'Unknown'}`);
            console.log(`      User: ${assignment.assigned_user_name || 'No user linked'} (${assignment.assigned_user_id || 'N/A'})`);
            console.log(`      Action: ${assignment.action}, Latest: ${assignment.latest_assignment_flag}`);
            console.log(`      Assigned on: ${assignment.action_on}`);
        });

        // 4. Check if USR002 is assigned to ASS002
        const usr002Assignment = assignmentResult.rows.find(a => a.assigned_user_id === 'USR002');
        if (!usr002Assignment) {
            console.log('\n❌ USR002 is NOT assigned to ASS002!');
            console.log('   This is why USR002 didn\'t receive the notification.');
            console.log('   Only the assigned user receives asset update notifications.');
            return;
        }
        
        console.log('\n✅ USR002 is assigned to ASS002');

        // 5. Check USR002's FCM tokens
        console.log('\n4️⃣ Checking USR002\'s FCM tokens...');
        const tokensQuery = `
            SELECT 
                token_id, device_token, platform, device_type, 
                is_active, last_used, created_on
            FROM "tblFCMTokens" 
            WHERE user_id = 'USR002'
            ORDER BY created_on DESC
        `;
        
        const tokensResult = await db.query(tokensQuery);
        
        if (tokensResult.rows.length === 0) {
            console.log('❌ No FCM tokens found for USR002!');
            console.log('   This is why the notification wasn\'t delivered.');
            console.log('   The mobile app needs to register its FCM token first.');
            return;
        }
        
        console.log(`✅ Found ${tokensResult.rows.length} FCM token(s) for USR002:`);
        tokensResult.rows.forEach((token, index) => {
            console.log(`   ${index + 1}. Platform: ${token.platform}, Type: ${token.device_type}`);
            console.log(`      Active: ${token.is_active}, Last used: ${token.last_used}`);
            console.log(`      Token: ${token.device_token.substring(0, 20)}...`);
        });

        // 6. Check USR002's notification preferences
        console.log('\n5️⃣ Checking USR002\'s notification preferences...');
        const preferencesQuery = `
            SELECT 
                notification_type, is_enabled, push_enabled, email_enabled,
                created_on, updated_on
            FROM "tblNotificationPreferences" 
            WHERE user_id = 'USR002'
            ORDER BY notification_type
        `;
        
        const preferencesResult = await db.query(preferencesQuery);
        
        if (preferencesResult.rows.length === 0) {
            console.log('❌ No notification preferences found for USR002!');
            console.log('   This is why the notification wasn\'t sent.');
            console.log('   Notification preferences need to be created for the user.');
            return;
        }
        
        console.log(`✅ Found ${preferencesResult.rows.length} notification preference(s) for USR002:`);
        preferencesResult.rows.forEach((pref, index) => {
            console.log(`   ${index + 1}. Type: ${pref.notification_type}`);
            console.log(`      Enabled: ${pref.is_enabled}, Push: ${pref.push_enabled}, Email: ${pref.email_enabled}`);
        });

        // Check specifically for asset_updated preference
        const assetUpdatedPref = preferencesResult.rows.find(p => p.notification_type === 'asset_updated');
        if (!assetUpdatedPref) {
            console.log('\n❌ No "asset_updated" notification preference found for USR002!');
            console.log('   This is why the notification wasn\'t sent.');
            return;
        }
        
        if (!assetUpdatedPref.is_enabled || !assetUpdatedPref.push_enabled) {
            console.log('\n❌ "asset_updated" notifications are disabled for USR002!');
            console.log(`   Enabled: ${assetUpdatedPref.is_enabled}, Push: ${assetUpdatedPref.push_enabled}`);
            return;
        }
        
        console.log('\n✅ "asset_updated" notifications are enabled for USR002');

        // 7. Check notification history for recent asset_updated notifications
        console.log('\n6️⃣ Checking recent notification history...');
        const historyQuery = `
            SELECT 
                notification_id, notification_type, title, body, 
                status, sent_on, fcm_response
            FROM "tblNotificationHistory" 
            WHERE user_id = 'USR002' 
              AND notification_type = 'asset_updated'
              AND sent_on >= NOW() - INTERVAL '1 hour'
            ORDER BY sent_on DESC
        `;
        
        const historyResult = await db.query(historyQuery);
        
        if (historyResult.rows.length === 0) {
            console.log('⚠️  No recent "asset_updated" notifications found in history');
            console.log('   This suggests the notification was never sent.');
        } else {
            console.log(`✅ Found ${historyResult.rows.length} recent "asset_updated" notification(s):`);
            historyResult.rows.forEach((record, index) => {
                console.log(`   ${index + 1}. ${record.title} - ${record.status} (${record.sent_on})`);
                if (record.fcm_response) {
                    const response = JSON.parse(record.fcm_response);
                    console.log(`      FCM Response: ${JSON.stringify(response, null, 2)}`);
                }
            });
        }

        // 8. Check if the asset update actually triggered the notification code
        console.log('\n7️⃣ Checking server logs for asset update...');
        console.log('   Look for these log messages in your server console:');
        console.log('   - "📱 Asset update notification sent to user USR002 for asset ASS002"');
        console.log('   - "❌ Failed to send asset update notification"');
        console.log('   - "❌ Error in asset update notification flow"');

        console.log('\n🎯 Summary:');
        console.log('   If USR002 is assigned to ASS002 and has valid FCM tokens and preferences,');
        console.log('   but still didn\'t receive the notification, check:');
        console.log('   1. Server console logs for error messages');
        console.log('   2. Firebase configuration (FIREBASE_PROJECT_ID, etc.)');
        console.log('   3. Mobile app FCM token registration');
        console.log('   4. Mobile app notification permissions');
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        await db.end();
    }
}

// Run the debug
if (require.main === module) {
    debugAssetNotification().catch(console.error);
}

module.exports = { debugAssetNotification };
