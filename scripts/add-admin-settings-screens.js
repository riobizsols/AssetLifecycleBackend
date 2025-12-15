/**
 * Script: Add Admin Settings Screens to tblApps and tblJobRoleNav
 * 
 * This script adds three new admin settings screens:
 * 1. MAINTENANCECONFIG - Maintenance Configuration
 * 2. PROPERTIES - Properties
 * 3. BREAKDOWNREASONCODES - Breakdown Reason Codes
 * 
 * It will:
 * 1. Add app_ids to tblApps for all organizations
 * 2. Add navigation entries to tblJobRoleNav under ADMINSETTINGS (JRN020) for all job roles
 */

const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

const addAdminSettingsScreens = async () => {
  const dbPool = getDb();
  
  try {
    console.log('🚀 Starting: Add Admin Settings Screens...\n');
    
    // Define the three screens
    const screens = [
      {
        app_id: 'MAINTENANCECONFIG',
        label: 'Maintenance Configuration',
        sequence: 39
      },
      {
        app_id: 'PROPERTIES',
        label: 'Properties',
        sequence: 40
      },
      {
        app_id: 'BREAKDOWNREASONCODES',
        label: 'Breakdown Reason Codes',
        sequence: 41
      }
    ];
    
    // Step 1: Add apps to tblApps for all organizations
    console.log('📋 Step 1: Adding apps to tblApps...');
    const orgsResult = await dbPool.query('SELECT org_id FROM "tblOrgs" WHERE int_status = 1');
    const orgs = orgsResult.rows;
    
    console.log(`   Found ${orgs.length} organizations\n`);
    
    for (const screen of screens) {
      for (const org of orgs) {
        const checkApp = await dbPool.query(
          'SELECT app_id FROM "tblApps" WHERE app_id = $1 AND org_id = $2',
          [screen.app_id, org.org_id]
        );
        
        if (checkApp.rows.length === 0) {
          await dbPool.query(
            `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (app_id) DO UPDATE
             SET text = EXCLUDED.text,
                 int_status = EXCLUDED.int_status,
                 org_id = EXCLUDED.org_id`,
            [screen.app_id, screen.label, true, org.org_id]
          );
          console.log(`   ✅ Added ${screen.app_id} to tblApps for org ${org.org_id}`);
        } else {
          console.log(`   ℹ️  ${screen.app_id} already exists in tblApps for org ${org.org_id}`);
        }
      }
    }
    
    console.log('\n');
    
    // Step 2: Add to tblJobRoleNav under ADMINSETTINGS (JRN020) for all job roles
    console.log('📋 Step 2: Adding navigation entries to tblJobRoleNav...');
    
    // Get all job roles
    const jobRolesResult = await dbPool.query(
      'SELECT DISTINCT job_role_id, org_id FROM "tblJobRoles" WHERE int_status = 1'
    );
    const jobRoles = jobRolesResult.rows;
    
    console.log(`   Found ${jobRoles.length} job roles\n`);
    
    // Find the ADMINSETTINGS parent (JRN020) for each job role
    let totalAdded = 0;
    
    for (const jobRole of jobRoles) {
      // Check if this job role has ADMINSETTINGS (JRN020) parent
      const adminSettingsParent = await dbPool.query(
        `SELECT job_role_nav_id FROM "tblJobRoleNav" 
         WHERE job_role_id = $1 AND app_id = 'ADMINSETTINGS' AND int_status = 1`,
        [jobRole.job_role_id]
      );
      
      if (adminSettingsParent.rows.length === 0) {
        console.log(`   ⚠️  Job role ${jobRole.job_role_id} does not have ADMINSETTINGS parent, skipping...`);
        continue;
      }
      
      const parentId = adminSettingsParent.rows[0].job_role_nav_id;
      console.log(`   Processing job role ${jobRole.job_role_id} (parent: ${parentId})...`);
      
      for (const screen of screens) {
        // Check if navigation item already exists
        const checkNav = await dbPool.query(
          `SELECT job_role_nav_id FROM "tblJobRoleNav" 
           WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1`,
          [jobRole.job_role_id, screen.app_id]
        );
        
        if (checkNav.rows.length === 0) {
          // Generate job_role_nav_id
          const job_role_nav_id = await generateCustomId('job_role_nav', 3);
          
          // Insert into tblJobRoleNav
          await dbPool.query(
            `INSERT INTO "tblJobRoleNav" 
             (job_role_nav_id, org_id, int_status, job_role_id, parent_id, app_id, label, sub_menu, sequence, access_level, is_group, mob_desk)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              job_role_nav_id,
              jobRole.org_id,
              1, // int_status
              jobRole.job_role_id,
              parentId, // parent_id = JRN020 (ADMINSETTINGS)
              screen.app_id,
              screen.label,
              null, // sub_menu
              screen.sequence,
              'A', // access_level = Admin (full access)
              false, // is_group
              'D' // mob_desk = Desktop
            ]
          );
          totalAdded++;
          console.log(`      ✅ Added ${screen.app_id} to tblJobRoleNav`);
        } else {
          console.log(`      ℹ️  ${screen.app_id} already exists in tblJobRoleNav`);
        }
      }
    }
    
    console.log('\n✅ Script completed successfully!');
    console.log(`📊 Summary: Added ${totalAdded} navigation entries to tblJobRoleNav`);
    console.log('📝 Note: The screens will be visible in admin settings for users with the assigned job roles');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error;
  }
};

// Run script if called directly
if (require.main === module) {
  addAdminSettingsScreens()
    .then(() => {
      console.log('\n✨ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = addAdminSettingsScreens;

