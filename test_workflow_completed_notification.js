const pool = require('./config/db');
const fcmService = require('./services/fcmService');

/**
 * Test workflow completed notification directly
 */
async function testWorkflowCompletedNotification() {
  try {
    console.log('========================================');
    console.log('TESTING WORKFLOW COMPLETED NOTIFICATION');
    console.log('========================================\n');

    // Step 1: Get supervisor role
    const orgSettingsQuery = `
      SELECT value 
      FROM "tblOrgSettings" 
      WHERE key = 'm_supervisor_role'
      LIMIT 1
    `;
    const orgSettingsResult = await pool.query(orgSettingsQuery);
    
    if (orgSettingsResult.rows.length === 0) {
      console.log('❌ m_supervisor_role setting not found\n');
      return;
    }
    
    const supervisorRoleId = orgSettingsResult.rows[0].value;
    console.log(`✅ Supervisor role: ${supervisorRoleId}\n`);

    // Step 2: Get all users with supervisor role
    const usersQuery = `
      SELECT 
        u.user_id,
        u.full_name,
        u.email,
        u.emp_int_id
      FROM "tblUsers" u
      INNER JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
      WHERE ujr.job_role_id = $1
        AND u.int_status = 1
    `;
    
    const usersResult = await pool.query(usersQuery, [supervisorRoleId]);
    
    if (usersResult.rows.length === 0) {
      console.log(`❌ No active users found with role ${supervisorRoleId}\n`);
      return;
    }
    
    console.log(`Found ${usersResult.rows.length} user(s) with supervisor role:\n`);

    // Step 3: Test notification for each user
    for (const user of usersResult.rows) {
      console.log(`\n--- Testing notification for ${user.full_name} (${user.user_id}) ---`);
      
      // Check preference
      const prefQuery = `
        SELECT push_enabled 
        FROM "tblNotificationPreferences" 
        WHERE user_id = $1 AND notification_type = $2
      `;
      const prefResult = await pool.query(prefQuery, [user.user_id, 'workflow_completed']);
      
      if (prefResult.rows.length === 0) {
        console.log(`  ❌ Missing workflow_completed preference`);
        continue;
      }
      
      const pushEnabled = prefResult.rows[0].push_enabled;
      console.log(`  ✅ Preference exists: push_enabled = ${pushEnabled}`);
      
      if (!pushEnabled) {
        console.log(`  ⚠️  Push notifications are disabled for this user`);
        continue;
      }
      
      // Check device tokens
      const deviceTokens = await fcmService.getUserDeviceTokens(user.user_id);
      console.log(`  Device tokens: ${deviceTokens.length}`);
      
      if (deviceTokens.length === 0) {
        console.log(`  ❌ No device tokens found`);
        continue;
      }
      
      deviceTokens.forEach((token, index) => {
        console.log(`    Token ${index + 1}: ${token.token_id} (${token.platform}, active: ${token.is_active})`);
      });
      
      // Test sending notification
      console.log(`  Attempting to send test notification...`);
      
      try {
        const notificationResult = await fcmService.sendNotificationToUser({
          userId: user.user_id,
          title: 'Test: Maintenance Workflow Completed',
          body: 'This is a test notification. Maintenance workflow completed. Asset "Test Asset" is ready. You can check now.',
          data: {
            ams_id: 'TEST_AMS',
            asset_id: 'TEST_ASSET',
            asset_name: 'Test Asset',
            wfamsh_id: 'TEST_WFAMSH',
            notification_type: 'workflow_completed'
          },
          notificationType: 'workflow_completed'
        });
        
        if (notificationResult.success) {
          console.log(`  ✅ Notification sent successfully!`);
          console.log(`     Response:`, JSON.stringify(notificationResult, null, 2));
        } else {
          console.log(`  ❌ Notification failed: ${notificationResult.reason || 'Unknown error'}`);
          console.log(`     Response:`, JSON.stringify(notificationResult, null, 2));
        }
      } catch (error) {
        console.log(`  ❌ Error sending notification: ${error.message}`);
        console.log(`     Stack:`, error.stack);
      }
    }
    
    console.log('\n========================================');
    console.log('TEST COMPLETED');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error testing notification:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the test
testWorkflowCompletedNotification()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error running test:', error);
    process.exit(1);
  });

