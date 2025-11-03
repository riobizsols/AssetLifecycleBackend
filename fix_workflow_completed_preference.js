const pool = require('./config/db');

/**
 * Fix workflow_completed notification preference for users with supervisor role
 */
async function fixWorkflowCompletedPreference() {
  try {
    console.log('========================================');
    console.log('FIXING workflow_completed PREFERENCES');
    console.log('========================================\n');

    // Step 1: Get supervisor role ID from org settings
    const orgSettingsQuery = `
      SELECT value 
      FROM "tblOrgSettings" 
      WHERE key = 'm_supervisor_role'
      LIMIT 1
    `;
    const orgSettingsResult = await pool.query(orgSettingsQuery);
    
    if (orgSettingsResult.rows.length === 0) {
      console.log('❌ m_supervisor_role setting not found');
      return;
    }
    
    const supervisorRoleId = orgSettingsResult.rows[0].value;
    console.log(`✅ Found supervisor role: ${supervisorRoleId}\n`);

    // Step 2: Find all users with supervisor role who are missing workflow_completed preference
    const usersQuery = `
      SELECT 
        u.user_id,
        u.full_name,
        u.email
      FROM "tblUsers" u
      INNER JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
      WHERE ujr.job_role_id = $1
        AND u.int_status = 1
        AND NOT EXISTS (
          SELECT 1 
          FROM "tblNotificationPreferences" np
          WHERE np.user_id = u.user_id 
            AND np.notification_type = 'workflow_completed'
        )
    `;
    
    const usersResult = await pool.query(usersQuery, [supervisorRoleId]);
    
    if (usersResult.rows.length === 0) {
      console.log('✅ All supervisor users already have workflow_completed preference\n');
      return;
    }
    
    console.log(`Found ${usersResult.rows.length} user(s) missing workflow_completed preference:\n`);
    usersResult.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.full_name} (${user.user_id})`);
    });
    console.log('');

    // Step 3: Create preferences for missing users
    let successCount = 0;
    let failureCount = 0;
    
    for (const user of usersResult.rows) {
      try {
        const preferenceId = 'PREF' + Math.random().toString(36).substr(2, 15).toUpperCase();
        
        const insertQuery = `
          INSERT INTO "tblNotificationPreferences" (
            preference_id, user_id, notification_type, 
            is_enabled, email_enabled, push_enabled
          ) VALUES ($1, $2, $3, true, true, true)
        `;
        
        await pool.query(insertQuery, [preferenceId, user.user_id, 'workflow_completed']);
        console.log(`✅ Created workflow_completed preference for ${user.full_name} (${user.user_id})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create preference for ${user.full_name}:`, error.message);
        failureCount++;
      }
    }
    
    console.log('\n========================================');
    console.log(`SUMMARY: ${successCount} created, ${failureCount} failed`);
    console.log('========================================\n');

  } catch (error) {
    console.error('Error fixing preferences:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixWorkflowCompletedPreference()
  .then(() => {
    console.log('Fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running fix:', error);
    process.exit(1);
  });

