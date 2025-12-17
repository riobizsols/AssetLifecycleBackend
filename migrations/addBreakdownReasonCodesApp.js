/**
 * Migration: Add BREAKDOWNREASONCODES app to tblApps and tblJobRoleNav
 * 
 * This migration adds the BREAKDOWNREASONCODES app ID to:
 * 1. tblApps - to register the application (for all organizations)
 * 2. tblJobRoleNav - to assign it to job roles that should have access
 * 
 * Run this migration after creating the Breakdown Reason Codes feature
 */

const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

const addBreakdownReasonCodesApp = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Add BREAKDOWNREASONCODES app...');
    
    // Step 1: Add app to tblApps for all organizations
    const orgsResult = await dbPool.query('SELECT org_id FROM "tblOrgs" WHERE int_status = 1');
    const orgs = orgsResult.rows;
    
    console.log(`Found ${orgs.length} organizations`);
    
    for (const org of orgs) {
      const checkApp = await dbPool.query(
        'SELECT app_id FROM "tblApps" WHERE app_id = $1 AND org_id = $2',
        ['BREAKDOWNREASONCODES', org.org_id]
      );
      
      if (checkApp.rows.length === 0) {
        // Insert app into tblApps (using correct column names: app_id, text, int_status, org_id)
        await dbPool.query(
          `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (app_id, org_id) DO NOTHING`,
          [
            'BREAKDOWNREASONCODES',
            'Breakdown Reason Codes',
            true,
            org.org_id
          ]
        );
        console.log(`✅ Added BREAKDOWNREASONCODES to tblApps for org ${org.org_id}`);
      } else {
        console.log(`ℹ️ BREAKDOWNREASONCODES already exists in tblApps for org ${org.org_id}`);
      }
    }
    
    // Step 2: Add to tblJobRoleNav for all job roles (optional - you can customize this)
    // Get all job roles
    const jobRolesResult = await dbPool.query(
      'SELECT job_role_id, org_id FROM "tblJobRoles" WHERE int_status = 1'
    );
    const jobRoles = jobRolesResult.rows;
    
    console.log(`Found ${jobRoles.length} job roles`);
    
    let addedCount = 0;
    for (const jobRole of jobRoles) {
      // Check if navigation item already exists
      const checkNav = await dbPool.query(
        'SELECT job_role_nav_id FROM "tblJobRoleNav" WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1',
        [jobRole.job_role_id, 'BREAKDOWNREASONCODES']
      );
      
      if (checkNav.rows.length === 0) {
        // Generate job_role_nav_id
        const job_role_nav_id = await generateCustomId('job_role_nav', 3);
        
        // Get max sequence for this job role
        const maxSeqResult = await dbPool.query(
          'SELECT COALESCE(MAX(seq), 0) as max_seq FROM "tblJobRoleNav" WHERE job_role_id = $1',
          [jobRole.job_role_id]
        );
        const nextSeq = (maxSeqResult.rows[0]?.max_seq || 0) + 1;
        
        // Insert into tblJobRoleNav
        await dbPool.query(
          `INSERT INTO "tblJobRoleNav" 
           (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, seq, access_level, mob_desk, int_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            job_role_nav_id,
            jobRole.job_role_id,
            null, // parent_id - top level item
            'BREAKDOWNREASONCODES',
            'Breakdown Reason Codes',
            false, // is_group
            nextSeq,
            'V', // access_level - View access (can be changed to 'A' for Admin, 'E' for Edit)
            'D', // mob_desk - Desktop
            1 // int_status - Active
          ]
        );
        addedCount++;
        console.log(`✅ Added BREAKDOWNREASONCODES to tblJobRoleNav for job role ${jobRole.job_role_id}`);
      } else {
        console.log(`ℹ️ BREAKDOWNREASONCODES already exists in tblJobRoleNav for job role ${jobRole.job_role_id}`);
      }
    }
    
    console.log('✅ Migration completed successfully');
    console.log(`📊 Summary: Added ${addedCount} navigation entries to tblJobRoleNav`);
    console.log('📝 Note: The app will be visible in admin settings sidebar for users with the assigned job roles');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addBreakdownReasonCodesApp()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addBreakdownReasonCodesApp;

