const pool = require('./config/db');

async function debugRoleBasedApproval() {
  try {
    console.log('=== Debugging Role-Based Approval ===\n');
    
    // Step 1: Get your emp_int_id from input
    const testEmpIntId = process.argv[2] || 'EMP_INT_001'; // Pass as command line arg
    const testAssetId = process.argv[3] || 'ASS023'; // Pass as command line arg
    
    console.log(`Testing for Employee: ${testEmpIntId}`);
    console.log(`Testing for Asset: ${testAssetId}\n`);
    
    // Step 1: Check if user exists
    console.log('1️⃣ Checking if user exists...');
    const userQuery = `
      SELECT user_id, emp_int_id, full_name, email, int_status
      FROM "tblUsers"
      WHERE emp_int_id = $1
    `;
    const userResult = await pool.query(userQuery, [testEmpIntId]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ ERROR: User not found with emp_int_id:', testEmpIntId);
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log('✅ User found:', user.full_name);
    console.log('   user_id:', user.user_id);
    console.log('   Status:', user.int_status === 1 ? 'Active' : 'Inactive');
    console.log('');
    
    // Step 2: Check user's roles
    console.log('2️⃣ Checking user roles...');
    const rolesQuery = `
      SELECT ujr.user_job_role_id, ujr.job_role_id, jr.text as role_name
      FROM "tblUserJobRoles" ujr
      INNER JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
      WHERE ujr.user_id = $1
    `;
    const rolesResult = await pool.query(rolesQuery, [user.user_id]);
    
    if (rolesResult.rows.length === 0) {
      console.log('❌ ERROR: User has NO roles assigned in tblUserJobRoles!');
      console.log('   Solution: Assign roles to this user');
      console.log('   Example: INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id) VALUES (\'UJROLE_XXX\', \'${user.user_id}\', \'JR003\');');
      process.exit(1);
    }
    
    console.log(`✅ User has ${rolesResult.rows.length} role(s):`);
    const userRoles = rolesResult.rows.map(r => r.job_role_id);
    rolesResult.rows.forEach(r => {
      console.log(`   - ${r.job_role_id}: ${r.role_name}`);
    });
    console.log('');
    
    // Step 3: Check if workflow exists for asset
    console.log('3️⃣ Checking workflows for asset...');
    const workflowQuery = `
      SELECT 
        wfh.wfamsh_id,
        wfh.asset_id,
        wfh.status as header_status,
        wfh.pl_sch_date,
        a.text as asset_name
      FROM "tblWFAssetMaintSch_H" wfh
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      WHERE wfh.asset_id = $1 
        AND wfh.org_id = 'ORG001'
        AND wfh.status IN ('IN', 'IP')
      ORDER BY wfh.created_on DESC
      LIMIT 1
    `;
    const workflowResult = await pool.query(workflowQuery, [testAssetId]);
    
    if (workflowResult.rows.length === 0) {
      console.log('❌ ERROR: No active workflow found for asset:', testAssetId);
      console.log('   Workflow must have status IN or IP');
      process.exit(1);
    }
    
    const workflow = workflowResult.rows[0];
    console.log('✅ Workflow found:');
    console.log('   wfamsh_id:', workflow.wfamsh_id);
    console.log('   Asset:', workflow.asset_name);
    console.log('   Status:', workflow.header_status);
    console.log('');
    
    // Step 4: Check workflow details
    console.log('4️⃣ Checking workflow steps...');
    const stepsQuery = `
      SELECT 
        wfd.wfamsd_id,
        wfd.sequence,
        wfd.job_role_id,
        wfd.user_id,
        wfd.status,
        jr.text as role_name
      FROM "tblWFAssetMaintSch_D" wfd
      LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
      WHERE wfd.wfamsh_id = $1
        AND wfd.org_id = 'ORG001'
      ORDER BY wfd.sequence ASC
    `;
    const stepsResult = await pool.query(stepsQuery, [workflow.wfamsh_id]);
    
    if (stepsResult.rows.length === 0) {
      console.log('❌ ERROR: No workflow steps found!');
      process.exit(1);
    }
    
    console.log(`✅ Found ${stepsResult.rows.length} workflow step(s):`);
    stepsResult.rows.forEach(s => {
      const statusIcon = s.status === 'AP' ? '⏳' : s.status === 'UA' ? '✅' : s.status === 'UR' ? '❌' : '⏸️';
      console.log(`   ${statusIcon} Seq ${s.sequence}: ${s.role_name || 'Unknown Role'} (${s.job_role_id}) - Status: ${s.status}`);
      console.log(`      user_id: ${s.user_id || 'NULL ✅'}`);
    });
    console.log('');
    
    // Step 5: Check if user's role matches any workflow step
    console.log('5️⃣ Checking role matches...');
    const matchingSteps = stepsResult.rows.filter(s => userRoles.includes(s.job_role_id));
    
    if (matchingSteps.length === 0) {
      console.log('❌ ERROR: User\'s roles do NOT match any workflow step!');
      console.log(`   User roles: ${userRoles.join(', ')}`);
      console.log(`   Workflow requires: ${stepsResult.rows.map(s => s.job_role_id).join(', ')}`);
      console.log('   Solution: Assign user to one of the required roles');
      process.exit(1);
    }
    
    console.log(`✅ User has ${matchingSteps.length} matching step(s):`);
    matchingSteps.forEach(s => {
      console.log(`   - Seq ${s.sequence}: ${s.role_name} (${s.job_role_id}) - Status: ${s.status}`);
    });
    console.log('');
    
    // Step 6: Check if any matching step is in AP status
    console.log('6️⃣ Checking for pending approval...');
    const pendingStep = matchingSteps.find(s => s.status === 'AP');
    
    if (!pendingStep) {
      console.log('⚠️  WARNING: User has matching roles, but no step is in AP (Approval Pending) status');
      console.log('   Current statuses:');
      matchingSteps.forEach(s => {
        const statusText = {
          'IN': 'Inactive (waiting)',
          'AP': 'Approval Pending',
          'UA': 'User Approved (already done)',
          'UR': 'User Rejected',
          'IP': 'In Progress'
        }[s.status] || s.status;
        console.log(`   - Seq ${s.sequence}: ${statusText}`);
      });
      console.log('   This is why you cannot approve - the step is not ready for your action yet.');
      process.exit(0);
    }
    
    console.log('✅ READY FOR APPROVAL!');
    console.log('   Step:', pendingStep.sequence);
    console.log('   Role:', pendingStep.role_name);
    console.log('   Status: AP (Approval Pending)');
    console.log('   wfamsd_id:', pendingStep.wfamsd_id);
    console.log('');
    
    // Step 7: Show what the approval query would find
    console.log('7️⃣ Testing approval query...');
    const approvalTestQuery = `
      SELECT wfd.wfamsd_id, wfd.sequence, wfd.status, wfd.user_id, wfd.wfamsh_id, wfd.job_role_id, wfd.dept_id, wfd.notes
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      WHERE wfh.asset_id = $1 AND wfd.org_id = $2
        AND wfd.job_role_id = ANY($3::varchar[])
      ORDER BY wfd.sequence ASC
    `;
    const approvalTestResult = await pool.query(approvalTestQuery, [testAssetId, 'ORG001', userRoles]);
    
    console.log(`✅ Approval query would find ${approvalTestResult.rows.length} step(s)`);
    console.log(`   Looking for status 'AP'...`);
    const apStep = approvalTestResult.rows.find(w => w.status === 'AP');
    if (apStep) {
      console.log(`   ✅ Found AP step: Sequence ${apStep.sequence}`);
      console.log('');
      console.log('🎉 SUCCESS! You CAN approve this workflow!');
      console.log(`   Use: approveMaintenance('${testAssetId}', '${testEmpIntId}', 'Approved', 'ORG001')`);
    } else {
      console.log(`   ❌ No AP step found in matched steps`);
    }
    
    console.log('\n=== Debug Complete ===');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
    process.exit(1);
  }
}

// Run the debug
debugRoleBasedApproval();

