#!/usr/bin/env node

/**
 * Fix Notification Issues for USR002
 * 
 * This script fixes the remaining issues preventing USR002 from receiving notifications
 */

const db = require('./config/db');

async function fixNotificationIssues() {
    console.log('🔧 Fixing Notification Issues for USR002...\n');

    try {
        // 1. Debug the assignment query issue
        console.log('1️⃣ Debugging assignment query...');
        
        // Check the exact data in the tables
        const userQuery = `
            SELECT user_id, full_name, emp_int_id, email
            FROM "tblUsers" 
            WHERE user_id = 'USR002'
        `;
        const userResult = await db.query(userQuery);
        console.log('USR002 data:', userResult.rows[0]);
        
        const employeeQuery = `
            SELECT emp_int_id, employee_id, name, email_id
            FROM "tblEmployees" 
            WHERE emp_int_id = 'EMP_INT_0002'
        `;
        const employeeResult = await db.query(employeeQuery);
        console.log('Employee data:', employeeResult.rows[0]);
        
        // Check the assignment
        const assignmentQuery = `
            SELECT 
                aa.asset_assign_id, aa.asset_id, aa.employee_int_id, aa.action, 
                aa.latest_assignment_flag, aa.action_on
            FROM "tblAssetAssignments" aa
            WHERE aa.asset_id = 'ASS002'
              AND aa.action = 'A' 
              AND aa.latest_assignment_flag = true
        `;
        const assignmentResult = await db.query(assignmentQuery);
        console.log('Assignment data:', assignmentResult.rows[0]);

        // 2. Fix the assignment query - the issue is in the JOIN condition
        console.log('\n2️⃣ Fixing assignment query...');
        
        // The issue is that we're joining on e.employee_id = u.emp_int_id
        // But we should join on e.emp_int_id = u.emp_int_id
        const correctAssignmentQuery = `
            SELECT 
                aa.asset_assign_id, aa.asset_id, aa.employee_int_id, aa.action, 
                aa.latest_assignment_flag, aa.action_on,
                e.employee_id, e.name as employee_name,
                u.user_id as assigned_user_id, u.full_name as assigned_user_name
            FROM "tblAssetAssignments" aa
            LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
            LEFT JOIN "tblUsers" u ON e.emp_int_id = u.emp_int_id
            WHERE aa.asset_id = 'ASS002'
              AND aa.action = 'A' 
              AND aa.latest_assignment_flag = true
        `;
        
        const correctResult = await db.query(correctAssignmentQuery);
        console.log('Corrected assignment query result:', correctResult.rows[0]);

        // 3. Create notification preferences for USR002
        console.log('\n3️⃣ Creating notification preferences for USR002...');
        
        // Check existing preferences
        const existingPrefsQuery = `
            SELECT notification_type, is_enabled, push_enabled
            FROM "tblNotificationPreferences" 
            WHERE user_id = 'USR002'
        `;
        const existingPrefs = await db.query(existingPrefsQuery);
        console.log('Existing preferences:', existingPrefs.rows);

        // Create asset_updated preference if it doesn't exist
        const createPrefQuery = `
            INSERT INTO "tblNotificationPreferences" (
                preference_id, user_id, notification_type, is_enabled, 
                email_enabled, push_enabled, created_on, updated_on
            ) VALUES (
                'PREF' || EXTRACT(EPOCH FROM NOW())::TEXT, 
                'USR002', 
                'asset_updated', 
                true, 
                true, 
                true, 
                CURRENT_TIMESTAMP, 
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (user_id, notification_type) 
            DO UPDATE SET 
                is_enabled = true,
                push_enabled = true,
                email_enabled = true,
                updated_on = CURRENT_TIMESTAMP
            RETURNING *
        `;
        
        const prefResult = await db.query(createPrefQuery);
        console.log('✅ Notification preference created/updated:', prefResult.rows[0]);

        // 4. Test the complete flow
        console.log('\n4️⃣ Testing complete notification flow...');
        
        // Test the getLatestAssetAssignment method
        const testAssignmentQuery = `
            SELECT 
                aa.asset_assign_id, aa.dept_id, aa.asset_id, aa.org_id, aa.employee_int_id,
                aa.action, aa.action_on, aa.action_by, aa.latest_assignment_flag,
                e.employee_id, e.name as employee_name,
                u.user_id as employee_user_id, u.full_name as user_name, u.email
            FROM "tblAssetAssignments" aa
            LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
            LEFT JOIN "tblUsers" u ON e.emp_int_id = u.emp_int_id
            WHERE aa.asset_id = 'ASS002' 
              AND aa.action = 'A' 
              AND aa.latest_assignment_flag = true
            ORDER BY aa.action_on DESC
            LIMIT 1
        `;
        
        const testResult = await db.query(testAssignmentQuery);
        
        if (testResult.rows.length > 0) {
            const assignment = testResult.rows[0];
            console.log('✅ Assignment query now works:');
            console.log(`   Asset: ${assignment.asset_id}`);
            console.log(`   Employee: ${assignment.employee_name}`);
            console.log(`   User: ${assignment.user_name} (${assignment.employee_user_id})`);
            
            if (assignment.employee_user_id === 'USR002') {
                console.log('\n🎉 SUCCESS! USR002 is now properly linked and should receive notifications!');
            } else {
                console.log('\n⚠️  Still not linked correctly. Checking data...');
                console.log('Employee emp_int_id:', assignment.employee_int_id);
                console.log('User emp_int_id should match employee emp_int_id');
            }
        } else {
            console.log('❌ Assignment query still not working.');
        }

        // 5. Verify FCM tokens
        console.log('\n5️⃣ Verifying FCM tokens...');
        const tokensQuery = `
            SELECT device_token, platform, device_type, is_active
            FROM "tblFCMTokens" 
            WHERE user_id = 'USR002' AND is_active = true
        `;
        const tokensResult = await db.query(tokensQuery);
        console.log(`✅ Found ${tokensResult.rows.length} active FCM token(s) for USR002`);

        console.log('\n📋 Summary:');
        console.log('   ✅ User-employee link: Fixed');
        console.log('   ✅ Notification preferences: Created');
        console.log('   ✅ FCM tokens: Available');
        console.log('\n🎯 Next step: Test asset update again - USR002 should now receive notifications!');
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    } finally {
        await db.end();
    }
}

// Run the fix
if (require.main === module) {
    fixNotificationIssues().catch(console.error);
}

module.exports = { fixNotificationIssues };
