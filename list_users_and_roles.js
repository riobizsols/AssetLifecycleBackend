const pool = require('./config/db');

async function listUsersAndRoles() {
  try {
    console.log('=== Listing All Users and Their Roles ===\n');
    
    // Get all active users
    const usersQuery = `
      SELECT u.emp_int_id, u.user_id, u.full_name, u.email
      FROM "tblUsers" u
      WHERE u.int_status = 1
      ORDER BY u.full_name
    `;
    const usersResult = await pool.query(usersQuery);
    
    console.log(`Found ${usersResult.rows.length} active user(s):\n`);
    
    for (const user of usersResult.rows) {
      console.log(`👤 ${user.full_name} (${user.emp_int_id})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   user_id: ${user.user_id}`);
      
      // Get roles for this user
      const rolesQuery = `
        SELECT ujr.job_role_id, jr.text as role_name
        FROM "tblUserJobRoles" ujr
        INNER JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
        WHERE ujr.user_id = $1
      `;
      const rolesResult = await pool.query(rolesQuery, [user.user_id]);
      
      if (rolesResult.rows.length > 0) {
        console.log('   Roles:');
        rolesResult.rows.forEach(r => {
          console.log(`   ✅ ${r.job_role_id}: ${r.role_name}`);
        });
      } else {
        console.log('   ⚠️  NO ROLES ASSIGNED');
      }
      console.log('');
    }
    
    console.log('\n=== Now check pending workflows ===\n');
    
    // Get workflows with AP status
    const workflowsQuery = `
      SELECT 
        wfh.wfamsh_id,
        wfh.asset_id,
        a.text as asset_name,
        wfh.status as header_status,
        wfd.sequence,
        wfd.job_role_id,
        jr.text as role_required,
        wfd.status as step_status
      FROM "tblWFAssetMaintSch_H" wfh
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
      LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
      WHERE wfh.org_id = 'ORG001'
        AND wfh.status IN ('IN', 'IP')
        AND wfd.status = 'AP'
      ORDER BY wfh.wfamsh_id, wfd.sequence
    `;
    const workflowsResult = await pool.query(workflowsQuery);
    
    if (workflowsResult.rows.length === 0) {
      console.log('⚠️  No workflows pending approval (status AP)');
    } else {
      console.log(`Found ${workflowsResult.rows.length} step(s) awaiting approval:\n`);
      workflowsResult.rows.forEach(w => {
        console.log(`📋 Asset: ${w.asset_name} (${w.asset_id})`);
        console.log(`   Workflow: ${w.wfamsh_id}`);
        console.log(`   Step: ${w.sequence}`);
        console.log(`   Requires: ${w.role_required} (${w.job_role_id})`);
        console.log(`   Status: ${w.step_status}`);
        console.log('');
      });
    }
    
    console.log('\n=== Instructions ===');
    console.log('1. Pick a user from the list above (note their emp_int_id)');
    console.log('2. Make sure they have a role assigned');
    console.log('3. Make sure their role matches a workflow that needs approval');
    console.log('4. Run: node debug_role_based_approval.js [emp_int_id] [asset_id]');
    console.log('   Example: node debug_role_based_approval.js EMP_INT_123 ASS023');
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listUsersAndRoles();

