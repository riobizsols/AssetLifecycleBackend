const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

(async () => {
  const db = getDb();
  
  console.log('📋 Verifying Admin Settings Screens...\n');
  
  // Check apps
  const appsRes = await db.query(
    `SELECT app_id, text, org_id FROM "tblApps" 
     WHERE app_id IN ('MAINTENANCECONFIG', 'PROPERTIES', 'BREAKDOWNREASONCODES') 
     ORDER BY app_id, org_id`
  );
  
  console.log('✅ Apps in tblApps:');
  appsRes.rows.forEach(row => {
    console.log(`   - ${row.app_id}: ${row.text} (org: ${row.org_id})`);
  });
  
  // Check navigation entries
  const navRes = await db.query(
    `SELECT job_role_nav_id, job_role_id, app_id, label, parent_id 
     FROM "tblJobRoleNav" 
     WHERE app_id IN ('MAINTENANCECONFIG', 'PROPERTIES', 'BREAKDOWNREASONCODES') 
     AND int_status = 1 
     ORDER BY job_role_id, app_id`
  );
  
  console.log(`\n✅ Navigation entries in tblJobRoleNav: ${navRes.rows.length} entries`);
  const byJobRole = {};
  navRes.rows.forEach(row => {
    if (!byJobRole[row.job_role_id]) {
      byJobRole[row.job_role_id] = [];
    }
    byJobRole[row.job_role_id].push(row);
  });
  
  Object.keys(byJobRole).sort().forEach(jobRoleId => {
    console.log(`\n   Job Role ${jobRoleId}:`);
    byJobRole[jobRoleId].forEach(entry => {
      console.log(`      - ${entry.app_id} (${entry.job_role_nav_id}, parent: ${entry.parent_id})`);
    });
  });
  
  console.log('\n✨ Verification complete!');
  process.exit(0);
})();

