const pool = require('./config/db');

/**
 * Fix workflow_rejection_reverted notification preference for all active users
 * This ensures users can receive notifications when workflows are reverted due to rejection
 */
async function fixWorkflowRejectionRevertedPreference() {
  try {
    console.log('========================================');
    console.log('FIXING workflow_rejection_reverted PREFERENCES');
    console.log('========================================\n');

    // Step 1: Find all active users who are missing workflow_rejection_reverted preference
    const usersQuery = `
      SELECT DISTINCT u.user_id, u.full_name, u.email
      FROM "tblUsers" u
      WHERE u.int_status = 1
        AND NOT EXISTS (
          SELECT 1 
          FROM "tblNotificationPreferences" np
          WHERE np.user_id = u.user_id 
            AND np.notification_type = 'workflow_rejection_reverted'
        )
      ORDER BY u.user_id
    `;
    
    const usersResult = await pool.query(usersQuery);
    
    if (usersResult.rows.length === 0) {
      console.log('✅ All users already have workflow_rejection_reverted preference\n');
      return;
    }
    
    console.log(`Found ${usersResult.rows.length} user(s) missing workflow_rejection_reverted preference:\n`);
    usersResult.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.full_name} (${user.user_id})`);
    });
    console.log('');

    // Step 2: Create preferences for missing users
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
        
        await pool.query(insertQuery, [preferenceId, user.user_id, 'workflow_rejection_reverted']);
        console.log(`✅ Created workflow_rejection_reverted preference for ${user.full_name} (${user.user_id})`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to create preference for ${user.full_name}:`, error.message);
        failureCount++;
      }
    }
    
    console.log('\n========================================');
    console.log(`SUMMARY: ${successCount} created, ${failureCount} failed`);
    console.log('========================================\n');

    // Step 3: Verify preferences were created
    const verifyQuery = `
      SELECT COUNT(*) as total_users,
             COUNT(CASE WHEN np.notification_type = 'workflow_rejection_reverted' THEN 1 END) as has_preference
      FROM "tblUsers" u
      LEFT JOIN "tblNotificationPreferences" np ON u.user_id = np.user_id 
        AND np.notification_type = 'workflow_rejection_reverted'
      WHERE u.int_status = 1
    `;
    const verifyResult = await pool.query(verifyQuery);
    const stats = verifyResult.rows[0];
    
    console.log('Verification:');
    console.log(`  Total active users: ${stats.total_users}`);
    console.log(`  Users with preference: ${stats.has_preference}`);
    console.log(`  Coverage: ${((stats.has_preference / stats.total_users) * 100).toFixed(1)}%\n`);

  } catch (error) {
    console.error('Error fixing preferences:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
fixWorkflowRejectionRevertedPreference()
  .then(() => {
    console.log('Fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running fix:', error);
    process.exit(1);
  });

