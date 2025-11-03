const pool = require('./config/db');

/**
 * Check notification preferences for users
 * Specifically checks USR015 and supervisor role users
 */
async function checkNotificationPreferences() {
  try {
    console.log('========================================');
    console.log('NOTIFICATION PREFERENCES CHECK');
    console.log('========================================\n');

    // Step 1: Check USR015 specifically
    console.log('1. Checking USR015 notification preferences:');
    console.log('------------------------------------------');
    
    const usr015Query = `
      SELECT 
        u.user_id,
        u.emp_int_id,
        u.full_name,
        u.email,
        u.int_status as user_status,
        np.preference_id,
        np.notification_type,
        np.is_enabled,
        np.email_enabled,
        np.push_enabled,
        np.created_on,
        np.updated_on
      FROM "tblUsers" u
      LEFT JOIN "tblNotificationPreferences" np ON u.user_id = np.user_id
      WHERE u.user_id = 'USR015' OR u.emp_int_id = 'USR015'
      ORDER BY np.notification_type
    `;
    
    const usr015Result = await pool.query(usr015Query);
    
    if (usr015Result.rows.length === 0) {
      console.log('❌ USR015 not found in tblUsers\n');
    } else {
      const user = usr015Result.rows[0];
      console.log(`✅ Found user: ${user.full_name}`);
      console.log(`   User ID: ${user.user_id}`);
      console.log(`   Emp Int ID: ${user.emp_int_id || 'N/A'}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   User Status: ${user.user_status === 1 ? '✅ Active' : '❌ Inactive'}\n`);
      
      if (user.preference_id) {
        const preferences = usr015Result.rows;
        console.log(`   Notification Preferences (${preferences.length}):`);
        preferences.forEach(pref => {
          console.log(`   - ${pref.notification_type || 'No preferences'}:`);
          if (pref.notification_type) {
            console.log(`     • Enabled: ${pref.is_enabled ? '✅' : '❌'}`);
            console.log(`     • Email: ${pref.email_enabled ? '✅' : '❌'}`);
            console.log(`     • Push: ${pref.push_enabled ? '✅' : '❌'}`);
            console.log(`     • Created: ${pref.created_on}`);
          }
        });
      } else {
        console.log('   ❌ No notification preferences found for USR015');
      }
      console.log('');
    }

    // Step 2: Check USR015's job roles
    console.log('2. Checking USR015 job roles:');
    console.log('------------------------------------------');
    
    const roleQuery = `
      SELECT 
        u.user_id,
        u.emp_int_id,
        ujr.job_role_id,
        jr.text as role_name
      FROM "tblUsers" u
      LEFT JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
      LEFT JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
      WHERE (u.user_id = 'USR015' OR u.emp_int_id = 'USR015')
    `;
    
    const roleResult = await pool.query(roleQuery);
    
    if (roleResult.rows.length === 0 || !roleResult.rows[0].job_role_id) {
      console.log('❌ USR015 has no assigned job roles\n');
    } else {
      roleResult.rows.forEach(row => {
        console.log(`   Job Role: ${row.role_name || 'N/A'} (${row.job_role_id})`);
      });
      console.log('');
    }

    // Step 3: Check m_supervisor_role setting
    console.log('3. Checking m_supervisor_role setting:');
    console.log('------------------------------------------');
    
    const supervisorRoleQuery = `
      SELECT key, value 
      FROM "tblOrgSettings" 
      WHERE key = 'm_supervisor_role'
      ORDER BY org_id
    `;
    
    const supervisorRoleResult = await pool.query(supervisorRoleQuery);
    
    if (supervisorRoleResult.rows.length === 0) {
      console.log('❌ m_supervisor_role setting not found in tblOrgSettings\n');
    } else {
      supervisorRoleResult.rows.forEach(row => {
        console.log(`   ✅ Setting found: ${row.key} = ${row.value}`);
      });
      console.log('');
    }

    // Step 4: Check all users with supervisor role (JR007)
    console.log('4. Checking all users with supervisor role:');
    console.log('------------------------------------------');
    
    const supervisorRoleId = supervisorRoleResult.rows[0]?.value || 'JR007';
    
    const supervisorUsersQuery = `
      SELECT 
        u.user_id,
        u.emp_int_id,
        u.full_name,
        u.email,
        u.int_status as user_status,
        ujr.job_role_id,
        jr.text as role_name,
        np.preference_id,
        np.notification_type,
        np.push_enabled
      FROM "tblUsers" u
      INNER JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
      INNER JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
      LEFT JOIN "tblNotificationPreferences" np ON u.user_id = np.user_id 
        AND np.notification_type = 'workflow_completed'
      WHERE ujr.job_role_id = $1
        AND u.int_status = 1
      ORDER BY u.full_name
    `;
    
    const supervisorUsersResult = await pool.query(supervisorUsersQuery, [supervisorRoleId]);
    
    if (supervisorUsersResult.rows.length === 0) {
      console.log(`❌ No active users found with role ${supervisorRoleId}\n`);
    } else {
      console.log(`✅ Found ${supervisorUsersResult.rows.length} user(s) with role ${supervisorRoleId}:\n`);
      supervisorUsersResult.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.full_name} (${user.user_id})`);
        console.log(`      Email: ${user.email || 'N/A'}`);
        console.log(`      Role: ${user.role_name} (${user.job_role_id})`);
        console.log(`      workflow_completed preference: ${user.preference_id ? (user.push_enabled ? '✅ Enabled' : '❌ Disabled') : '❌ Missing'}`);
        console.log('');
      });
    }

    // Step 5: Check device tokens for USR015
    console.log('5. Checking device tokens for USR015:');
    console.log('------------------------------------------');
    
    const deviceTokenQuery = `
      SELECT 
        token_id,
        device_type,
        platform,
        is_active,
        last_used,
        created_on
      FROM "tblFCMTokens"
      WHERE user_id = (SELECT user_id FROM "tblUsers" WHERE user_id = 'USR015' OR emp_int_id = 'USR015' LIMIT 1)
      ORDER BY created_on DESC
    `;
    
    const deviceTokenResult = await pool.query(deviceTokenQuery);
    
    if (deviceTokenResult.rows.length === 0) {
      console.log('❌ No device tokens found for USR015');
      console.log('   ⚠️  User needs to register their device via mobile app\n');
    } else {
      console.log(`✅ Found ${deviceTokenResult.rows.length} device token(s):\n`);
      deviceTokenResult.rows.forEach((token, index) => {
        console.log(`   ${index + 1}. Token: ${token.token_id}`);
        console.log(`      Platform: ${token.platform || 'N/A'}`);
        console.log(`      Active: ${token.is_active ? '✅' : '❌'}`);
        console.log(`      Last Used: ${token.last_used || 'Never'}`);
        console.log('');
      });
    }

    // Step 6: Summary and recommendations
    console.log('========================================');
    console.log('SUMMARY & RECOMMENDATIONS');
    console.log('========================================\n');
    
    const usr015 = usr015Result.rows[0];
    const hasWorkflowCompletedPref = usr015?.preference_id && 
      usr015Result.rows.some(p => p.notification_type === 'workflow_completed');
    const hasDeviceTokens = deviceTokenResult.rows.length > 0;
    const hasSupervisorRole = roleResult.rows.some(r => r.job_role_id === supervisorRoleId);
    
    console.log('USR015 Status:');
    console.log(`  • User exists: ${usr015 ? '✅' : '❌'}`);
    console.log(`  • User active: ${usr015?.user_status === 1 ? '✅' : '❌'}`);
    console.log(`  • Has supervisor role: ${hasSupervisorRole ? '✅' : '❌'}`);
    console.log(`  • Has workflow_completed preference: ${hasWorkflowCompletedPref ? '✅' : '❌'}`);
    console.log(`  • Has device tokens: ${hasDeviceTokens ? '✅' : '❌'}`);
    console.log('');
    
    if (!usr015) {
      console.log('⚠️  ISSUE: USR015 not found in tblUsers');
    } else if (usr015.user_status !== 1) {
      console.log('⚠️  ISSUE: USR015 is inactive (int_status != 1)');
    } else if (!hasSupervisorRole) {
      console.log('⚠️  ISSUE: USR015 does not have supervisor role assigned');
    } else if (!hasWorkflowCompletedPref) {
      console.log('⚠️  ISSUE: USR015 missing workflow_completed notification preference');
      console.log('   → This will be auto-created on next workflow completion');
    } else if (!hasDeviceTokens) {
      console.log('⚠️  ISSUE: USR015 has no registered device tokens');
      console.log('   → User needs to open mobile app and register FCM token');
    } else {
      console.log('✅ All checks passed! USR015 should receive notifications.');
    }
    
    console.log('\n========================================\n');

  } catch (error) {
    console.error('Error checking notification preferences:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the check
checkNotificationPreferences()
  .then(() => {
    console.log('Check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running check:', error);
    process.exit(1);
  });

