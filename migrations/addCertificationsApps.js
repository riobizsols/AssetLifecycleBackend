/**
 * Migration: Add Certifications Apps to tblApps and tblJobRoleNav
 * 
 * This script adds certification-related apps:
 * 1. CERTIFICATIONS - Manage Certifications
 * 2. TECHCERTUPLOAD - Technician Certificates
 * 3. HR/MANAGERAPPROVAL - HR/Manager Approval
 * 
 * It will:
 * 1. Add app_ids to tblApps for all organizations
 * 2. Add navigation entries to tblJobRoleNav for all job roles
 */

const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

const addCertificationsApps = async () => {
  const dbPool = getDb();
  
  try {
    console.log('🚀 Starting: Add Certifications Apps...\n');
    
    // Define the certifications-related apps
    const apps = [
      {
        app_id: 'CERTIFICATIONS',
        label: 'Certifications',
        sequence: 50
      },
      {
        app_id: 'TECHCERTUPLOAD',
        label: 'Technician Certificates',
        sequence: 51
      },
      {
        app_id: 'HR/MANAGERAPPROVAL',
        label: 'HR/Manager Approval',
        sequence: 52
      }
    ];
    
    // Step 1: Add apps to tblApps for all organizations
    console.log('📋 Step 1: Adding apps to tblApps...\n');
    const orgsResult = await dbPool.query('SELECT org_id FROM "tblOrgs" WHERE int_status = 1');
    const orgs = orgsResult.rows;
    
    console.log(`   Found ${orgs.length} organizations`);
    
    for (const app of apps) {
      for (const org of orgs) {
        try {
          const checkApp = await dbPool.query(
            'SELECT app_id FROM "tblApps" WHERE app_id = $1 AND org_id = $2',
            [app.app_id, org.org_id]
          );
          
          if (checkApp.rows.length === 0) {
            await dbPool.query(
              `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
               VALUES ($1, $2, $3, $4)`,
              [app.app_id, app.label, true, org.org_id]
            );
            console.log(`   ✅ Added ${app.app_id} to org ${org.org_id}`);
          } else {
            console.log(`   ℹ️  ${app.app_id} already exists for org ${org.org_id}`);
          }
        } catch (error) {
          if (error.code === '23505') {
            console.log(`   ℹ️  ${app.app_id} already exists for org ${org.org_id} (duplicate key)`);
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('\n📋 Step 2: Adding navigation entries to tblJobRoleNav...\n');
    
    // Get all job roles
    const jobRolesResult = await dbPool.query(
      'SELECT DISTINCT job_role_id, org_id FROM "tblJobRoles" WHERE int_status = 1'
    );
    const jobRoles = jobRolesResult.rows;
    
    console.log(`   Found ${jobRoles.length} job roles\n`);
    
    let totalAdded = 0;
    
    // For each job role, add certifications apps as top-level items
    for (const jobRole of jobRoles) {
      console.log(`   Processing job role ${jobRole.job_role_id}...`);
      
      for (const app of apps) {
        // Check if navigation item already exists
        const checkNav = await dbPool.query(
          `SELECT job_role_nav_id FROM "tblJobRoleNav" 
           WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1`,
          [jobRole.job_role_id, app.app_id]
        );
        
        if (checkNav.rows.length === 0) {
          // Generate unique ID
          const job_role_nav_id = await generateCustomId('job_role_nav', 3);
          
          // Determine access level based on job role
          // JR001 (Admin) gets full access (A), others get read-only (D)
          const accessLevel = jobRole.job_role_id === 'JR001' ? 'A' : 'D';
          
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
              null, // parent_id = null (top-level item)
              app.app_id,
              app.label,
              null, // sub_menu
              app.sequence,
              accessLevel, // access_level (A or D)
              false, // is_group
              'D' // mob_desk = Desktop
            ]
          );
          totalAdded++;
          console.log(`      ✅ Added ${app.app_id} (${accessLevel})`);
        } else {
          console.log(`      ℹ️  ${app.app_id} already exists`);
        }
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log(`📊 Summary: Added ${totalAdded} navigation entries`);
    console.log('📝 Note: Users with JR001 (Admin) role get full access (A)');
    console.log('         Other users get read-only access (D)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addCertificationsApps()
    .then(() => {
      console.log('\n✨ All done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addCertificationsApps;
