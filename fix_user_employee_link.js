#!/usr/bin/env node

/**
 * Fix User-Employee Link for USR002
 * 
 * This script fixes the missing link between USR002 and the employee assigned to ASS002
 */

const db = require('./config/db');

async function fixUserEmployeeLink() {
    console.log('🔧 Fixing User-Employee Link for USR002...\n');

    try {
        // 1. Check current state of USR002
        console.log('1️⃣ Checking current state of USR002...');
        const userQuery = `
            SELECT user_id, full_name, emp_int_id, email
            FROM "tblUsers" 
            WHERE user_id = 'USR002'
        `;
        
        const userResult = await db.query(userQuery);
        
        if (userResult.rows.length === 0) {
            console.log('❌ USR002 not found in tblUsers!');
            return;
        }
        
        const user = userResult.rows[0];
        console.log(`✅ USR002 found: ${user.full_name} (Email: ${user.email})`);
        console.log(`   Current emp_int_id: ${user.emp_int_id || 'NULL'}`);

        // 2. Check the employee assigned to ASS002
        console.log('\n2️⃣ Checking employee assigned to ASS002...');
        const assignmentQuery = `
            SELECT 
                aa.employee_int_id, e.employee_id, e.name as employee_name, e.email_id
            FROM "tblAssetAssignments" aa
            INNER JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
            WHERE aa.asset_id = 'ASS002' 
              AND aa.action = 'A' 
              AND aa.latest_assignment_flag = true
        `;
        
        const assignmentResult = await db.query(assignmentQuery);
        
        if (assignmentResult.rows.length === 0) {
            console.log('❌ No employee assignment found for ASS002!');
            return;
        }
        
        const employee = assignmentResult.rows[0];
        console.log(`✅ Employee found: ${employee.employee_name} (ID: ${employee.employee_id})`);
        console.log(`   Employee internal ID: ${employee.employee_int_id}`);

        // 3. Check if there's a mismatch
        if (user.emp_int_id === employee.employee_int_id) {
            console.log('\n✅ User and employee are already linked correctly!');
            console.log('   The issue might be elsewhere. Let me check the assignment query...');
        } else {
            console.log('\n❌ User and employee are NOT linked!');
            console.log(`   User emp_int_id: ${user.emp_int_id}`);
            console.log(`   Employee emp_int_id: ${employee.employee_int_id}`);
            
            // 4. Fix the link
            console.log('\n3️⃣ Fixing the user-employee link...');
            const updateQuery = `
                UPDATE "tblUsers" 
                SET emp_int_id = $1, changed_on = CURRENT_TIMESTAMP
                WHERE user_id = 'USR002'
                RETURNING *
            `;
            
            const updateResult = await db.query(updateQuery, [employee.employee_int_id]);
            
            if (updateResult.rows.length > 0) {
                console.log('✅ User-employee link updated successfully!');
                console.log(`   USR002 now linked to employee ${employee.employee_int_id}`);
            } else {
                console.log('❌ Failed to update user-employee link!');
                return;
            }
        }

        // 5. Test the assignment query again
        console.log('\n4️⃣ Testing the assignment query after fix...');
        const testAssignmentQuery = `
            SELECT 
                aa.asset_assign_id, aa.asset_id, aa.employee_int_id, aa.action, 
                aa.latest_assignment_flag, aa.action_on,
                e.employee_id, e.name as employee_name,
                u.user_id as assigned_user_id, u.full_name as assigned_user_name
            FROM "tblAssetAssignments" aa
            LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
            LEFT JOIN "tblUsers" u ON e.employee_id = u.emp_int_id
            WHERE aa.asset_id = 'ASS002'
              AND aa.action = 'A' 
              AND aa.latest_assignment_flag = true
        `;
        
        const testResult = await db.query(testAssignmentQuery);
        
        if (testResult.rows.length > 0) {
            const assignment = testResult.rows[0];
            console.log('✅ Assignment query now works correctly:');
            console.log(`   Asset: ${assignment.asset_id}`);
            console.log(`   Employee: ${assignment.employee_name}`);
            console.log(`   User: ${assignment.assigned_user_name} (${assignment.assigned_user_id})`);
            
            if (assignment.assigned_user_id === 'USR002') {
                console.log('\n🎉 SUCCESS! USR002 is now properly linked to ASS002!');
                console.log('   Asset update notifications should now work for USR002.');
            } else {
                console.log('\n⚠️  USR002 is still not linked. There might be another issue.');
            }
        } else {
            console.log('❌ Assignment query still not working correctly.');
        }

        // 6. Check if USR002 has FCM tokens and preferences
        console.log('\n5️⃣ Checking USR002\'s notification setup...');
        
        // Check FCM tokens
        const tokensQuery = `
            SELECT COUNT(*) as token_count
            FROM "tblFCMTokens" 
            WHERE user_id = 'USR002' AND is_active = true
        `;
        const tokensResult = await db.query(tokensQuery);
        console.log(`   FCM tokens: ${tokensResult.rows[0].token_count}`);
        
        // Check notification preferences
        const prefsQuery = `
            SELECT COUNT(*) as pref_count
            FROM "tblNotificationPreferences" 
            WHERE user_id = 'USR002' AND notification_type = 'asset_updated' AND push_enabled = true
        `;
        const prefsResult = await db.query(prefsQuery);
        console.log(`   Asset update preferences: ${prefsResult.rows[0].pref_count}`);
        
        if (tokensResult.rows[0].token_count === 0) {
            console.log('\n⚠️  USR002 has no active FCM tokens. Mobile app needs to register.');
        }
        
        if (prefsResult.rows[0].pref_count === 0) {
            console.log('\n⚠️  USR002 has no asset_updated notification preferences enabled.');
        }
        
        console.log('\n📋 Next steps:');
        console.log('   1. Test asset update again - USR002 should now receive notifications');
        console.log('   2. If still no notification, check FCM token registration');
        console.log('   3. If still no notification, check notification preferences');
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
    } finally {
        await db.end();
    }
}

// Run the fix
if (require.main === module) {
    fixUserEmployeeLink().catch(console.error);
}

module.exports = { fixUserEmployeeLink };
