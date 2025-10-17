const pool = require('./config/db');

async function migrateToRoleBased() {
  try {
    console.log('=== Migrating Existing Workflows to Role-Based System ===\n');
    
    // Step 1: Check current state
    console.log('1️⃣ Checking current workflows...');
    const checkQuery = `
      SELECT 
        COUNT(*) as total_steps,
        COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as steps_with_user_id,
        COUNT(CASE WHEN user_id IS NULL THEN 1 END) as steps_without_user_id
      FROM "tblWFAssetMaintSch_D"
      WHERE status IN ('IN', 'AP')
        AND job_role_id IS NOT NULL
    `;
    const checkResult = await pool.query(checkQuery);
    const stats = checkResult.rows[0];
    
    console.log(`   Total pending steps: ${stats.total_steps}`);
    console.log(`   With user_id (OLD): ${stats.steps_with_user_id} ← Need to migrate`);
    console.log(`   Without user_id (NEW): ${stats.steps_without_user_id} ← Already role-based`);
    console.log('');
    
    if (parseInt(stats.steps_with_user_id) === 0) {
      console.log('✅ No migration needed - all workflows are already role-based!');
      process.exit(0);
    }
    
    // Step 2: Show affected workflows
    console.log('2️⃣ Affected workflows:');
    const affectedQuery = `
      SELECT DISTINCT
        wfh.wfamsh_id,
        wfh.asset_id,
        a.text as asset_name,
        wfd.sequence,
        wfd.job_role_id,
        jr.text as role_name,
        wfd.user_id,
        wfd.status
      FROM "tblWFAssetMaintSch_D" wfd
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
      WHERE wfd.status IN ('IN', 'AP')
        AND wfd.user_id IS NOT NULL
        AND wfd.job_role_id IS NOT NULL
      ORDER BY wfh.wfamsh_id, wfd.sequence
      LIMIT 10
    `;
    const affectedResult = await pool.query(affectedQuery);
    
    affectedResult.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.asset_name} (${row.asset_id}) - ${row.role_name} [Status: ${row.status}]`);
      console.log(`      user_id: ${row.user_id} → Will be set to NULL`);
    });
    
    if (affectedResult.rows.length >= 10) {
      console.log(`   ... and ${parseInt(stats.steps_with_user_id) - 10} more steps`);
    }
    console.log('');
    
    // Step 3: Ask for confirmation
    console.log('⚠️  WARNING: This will update workflow steps to be role-based');
    console.log('   - user_id will be set to NULL for pending steps');
    console.log('   - Only job_role_id will be used');
    console.log('   - ALL users with the role will be able to approve');
    console.log('');
    console.log('   Completed steps (UA/UR) will NOT be changed');
    console.log('');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Do you want to proceed? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Migration cancelled');
        rl.close();
        process.exit(0);
      }
      
      console.log('');
      console.log('3️⃣ Starting migration...');
      
      try {
        // Update workflow steps - set user_id to NULL for pending steps
        const updateQuery = `
          UPDATE "tblWFAssetMaintSch_D"
          SET user_id = NULL
          WHERE status IN ('IN', 'AP')
            AND user_id IS NOT NULL
            AND job_role_id IS NOT NULL
          RETURNING wfamsd_id
        `;
        
        const updateResult = await pool.query(updateQuery);
        const updatedCount = updateResult.rows.length;
        
        console.log(`✅ Updated ${updatedCount} workflow step(s)`);
        console.log('   - user_id set to NULL');
        console.log('   - Now role-based (any user with role can approve)');
        console.log('');
        
        // Verify the migration
        console.log('4️⃣ Verifying migration...');
        const verifyResult = await pool.query(checkQuery);
        const newStats = verifyResult.rows[0];
        
        console.log(`   Total pending steps: ${newStats.total_steps}`);
        console.log(`   With user_id (OLD): ${newStats.steps_with_user_id}`);
        console.log(`   Without user_id (NEW): ${newStats.steps_without_user_id} ✅`);
        console.log('');
        
        if (parseInt(newStats.steps_with_user_id) === 0) {
          console.log('🎉 SUCCESS! All workflows are now role-based!');
          console.log('');
          console.log('Next steps:');
          console.log('1. Any user with the required role can now approve');
          console.log('2. Test approval: node debug_role_based_approval.js [emp_int_id] [asset_id]');
          console.log('3. Who approved will be tracked in tblWFAssetMaintHist.action_by');
        } else {
          console.log('⚠️  Some steps still have user_id set (might be in other statuses)');
        }
        
      } catch (error) {
        console.error('❌ Migration failed:', error);
        rl.close();
        process.exit(1);
      }
      
      rl.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

migrateToRoleBased();

