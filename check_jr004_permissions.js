const db = require('./config/db');

async function checkJR004Permissions() {
  try {
    console.log('🔍 Checking permissions for Job Role JR004...\n');
    
    // Check if JR004 exists in job roles
    const jobRoleCheck = await db.query(
      'SELECT * FROM "tblJobRoles" WHERE job_role_id = $1',
      ['JR004']
    );
    
    if (jobRoleCheck.rows.length === 0) {
      console.log('❌ Job Role JR004 does not exist in tblJobRoles');
      return;
    }
    
    console.log(`✅ Job Role JR004 exists: ${jobRoleCheck.rows[0].job_role_name || 'Unknown'}\n`);
    
    // Get navigation items for JR004
    const result = await db.query(
      `SELECT 
        job_role_nav_id,
        app_id,
        label,
        access_level,
        is_group,
        parent_id,
        sequence
       FROM "tblJobRoleNav" 
       WHERE job_role_id = 'JR004' AND int_status = 1
       ORDER BY sequence, job_role_nav_id`,
      []
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No navigation items found for JR004');
      console.log('This means users with JR004 role will see an empty sidebar');
      return;
    }
    
    console.log(`📊 Found ${result.rows.length} navigation items for JR004:\n`);
    
    // Group items by access level
    const accessLevels = {
      'A': [],
      'D': [],
      'N': []
    };
    
    result.rows.forEach((row, index) => {
      const accessType = row.access_level === 'A' ? 'Full Access' : 
                        row.access_level === 'D' ? 'Read Only' : 'No Access';
      
      console.log(`${index + 1}. ${row.label} (${row.app_id})`);
      console.log(`   - Access Level: ${row.access_level} (${accessType})`);
      console.log(`   - Is Group: ${row.is_group ? 'Yes' : 'No'}`);
      console.log(`   - Parent ID: ${row.parent_id || 'None'}`);
      console.log('');
      
      if (accessLevels[row.access_level]) {
        accessLevels[row.access_level].push(row);
      }
    });
    
    // Summary
    console.log('📋 Summary by Access Level:');
    console.log(`   Full Access (A): ${accessLevels['A'].length} items`);
    console.log(`   Read Only (D): ${accessLevels['D'].length} items`);
    console.log(`   No Access (N): ${accessLevels['N'].length} items`);
    
    // Show what users with JR004 can actually do
    console.log('\n🎯 What JR004 users can do:');
    
    if (accessLevels['A'].length > 0) {
      console.log('\n✅ Full Access (can view, edit, create, delete):');
      accessLevels['A'].forEach(item => {
        console.log(`   - ${item.label}`);
      });
    }
    
    if (accessLevels['D'].length > 0) {
      console.log('\n👁️ Read Only (can view only):');
      accessLevels['D'].forEach(item => {
        console.log(`   - ${item.label}`);
      });
    }
    
    if (accessLevels['A'].length === 0 && accessLevels['D'].length === 0) {
      console.log('\n❌ No accessible items - JR004 users will see an empty sidebar');
    }
    
  } catch (error) {
    console.error('❌ Error checking JR004 permissions:', error);
  } finally {
    await db.end();
  }
}

checkJR004Permissions(); 