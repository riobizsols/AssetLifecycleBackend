const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

(async () => {
  const db = getDb();
  
  console.log('🔍 Checking Admin Settings Navigation Structure...\n');
  
  // Get all ADMINSETTINGS entries
  const adminSettingsRes = await db.query(
    `SELECT job_role_nav_id, job_role_id, app_id, label, parent_id, sequence
     FROM "tblJobRoleNav" 
     WHERE app_id = 'ADMINSETTINGS' AND int_status = 1 
     ORDER BY job_role_id`
  );
  
  console.log('📋 ADMINSETTINGS entries:');
  adminSettingsRes.rows.forEach(row => {
    console.log(`   ${row.job_role_nav_id} - Job Role: ${row.job_role_id}, Parent: ${row.parent_id}`);
  });
  
  // Get children of ADMINSETTINGS
  const childrenRes = await db.query(
    `SELECT jrn.job_role_nav_id, jrn.job_role_id, jrn.app_id, jrn.label, jrn.parent_id, jrn.sequence,
            parent.job_role_nav_id as parent_nav_id, parent.app_id as parent_app_id
     FROM "tblJobRoleNav" jrn
     LEFT JOIN "tblJobRoleNav" parent ON jrn.parent_id = parent.job_role_nav_id
     WHERE jrn.app_id IN ('MAINTENANCECONFIG', 'PROPERTIES', 'BREAKDOWNREASONCODES', 'COLUMNACCESSCONFIG', 'USERROLES')
     AND jrn.int_status = 1
     ORDER BY jrn.job_role_id, jrn.sequence`
  );
  
  console.log('\n📋 Children entries:');
  const byJobRole = {};
  childrenRes.rows.forEach(row => {
    if (!byJobRole[row.job_role_id]) {
      byJobRole[row.job_role_id] = [];
    }
    byJobRole[row.job_role_id].push(row);
  });
  
  Object.keys(byJobRole).sort().forEach(jobRoleId => {
    console.log(`\n   Job Role ${jobRoleId}:`);
    byJobRole[jobRoleId].forEach(entry => {
      const parentInfo = entry.parent_app_id ? `(parent: ${entry.parent_nav_id} - ${entry.parent_app_id})` : '(no parent)';
      console.log(`      - ${entry.app_id}: ${entry.job_role_nav_id} ${parentInfo}`);
    });
  });
  
  // Check if parent_id matches ADMINSETTINGS
  console.log('\n🔍 Verifying parent relationships...');
  for (const adminSetting of adminSettingsRes.rows) {
    const children = await db.query(
      `SELECT app_id, label FROM "tblJobRoleNav" 
       WHERE parent_id = $1 AND int_status = 1
       ORDER BY sequence`,
      [adminSetting.job_role_nav_id]
    );
    
    if (children.rows.length > 0) {
      console.log(`\n   Job Role ${adminSetting.job_role_id} (${adminSetting.job_role_nav_id}) has ${children.rows.length} children:`);
      children.rows.forEach(child => {
        console.log(`      - ${child.app_id}: ${child.label}`);
      });
    }
  }
  
  console.log('\n✨ Check complete!');
  process.exit(0);
})();

