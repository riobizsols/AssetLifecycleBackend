const db = require('./config/db');

async function checkAppIds() {
  try {
    console.log('🔍 Checking all app_id values in the database...\n');
    
    const result = await db.query(
      `SELECT DISTINCT app_id, label 
       FROM "tblJobRoleNav" 
       WHERE int_status = 1
       ORDER BY app_id`
    );
    
    console.log('📋 All app_id values currently in use:\n');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.app_id} - ${row.label}`);
    });
    
    console.log(`\n📊 Total unique app_id values: ${result.rows.length}`);
    
    // Check which ones are missing from frontend mapping
    const frontendMappings = [
      'DASHBOARD', 'ASSETS', 'ADDASSET', 'ASSETASSIGNMENT', 'VENDORS', 'DEPTASSIGNMENT', 
      'EMPASSIGNMENT', 'MAINTENANCE', 'INSPECTION', 'MAINTENANCEAPPROVAL', 
      'SUPERVISORAPPROVAL', 'REPORTS', 'ADMINSETTINGS', 'MASTERDATA', 
      'ORGANIZATIONS', 'ASSETTYPES', 'DEPARTMENTS', 'DEPARTMENTSADMIN', 
      'DEPARTMENTSASSET', 'BRANCHES', 'PRODSERV', 'ROLES', 'USERS', 
      'MAINTENANCESCHEDULE', 'AUDITLOGS'
    ];
    
    console.log('\n🔍 Checking missing frontend mappings:\n');
    const missingMappings = [];
    
    result.rows.forEach(row => {
      if (!frontendMappings.includes(row.app_id)) {
        missingMappings.push(row.app_id);
        console.log(`❌ Missing: ${row.app_id} - ${row.label}`);
      }
    });
    
    if (missingMappings.length === 0) {
      console.log('✅ All app_id values have frontend mappings!');
    } else {
      console.log(`\n⚠️  Found ${missingMappings.length} missing frontend mappings:`);
      missingMappings.forEach(missing => {
        console.log(`   - ${missing}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking app_ids:', error);
  } finally {
    await db.end();
  }
}

checkAppIds(); 