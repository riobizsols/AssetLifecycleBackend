/**
 * Migration: Add COSTCENTERTRANSFER app to tblApps and tblJobRoleNav
 * 
 * This migration adds the COSTCENTERTRANSFER app ID to:
 * 1. tblApps - to register the application (for all organizations)
 * 2. tblJobRoleNav - to assign it to specific job roles (JR001, JR002, JR003, JR004) as a child of ASSETASSIGNMENT
 * 
 * The Cost Center Transfer screen will appear under Asset Assignment in the navigation
 * 
 * Run this migration after creating the Cost Center Transfer feature
 */

const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

const addCostCenterTransferApp = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Add COSTCENTERTRANSFER app...');
    
    // Step 1: Add app to tblApps (app_id is primary key, so it's unique across all orgs)
    // Check if app already exists
    const checkApp = await dbPool.query(
      'SELECT app_id FROM "tblApps" WHERE app_id = $1',
      ['COSTCENTERTRANSFER']
    );
    
    if (checkApp.rows.length === 0) {
      // Get first active organization to use for the app entry
      const orgResult = await dbPool.query('SELECT org_id FROM "tblOrgs" WHERE int_status = 1 LIMIT 1');
      const firstOrgId = orgResult.rows.length > 0 ? orgResult.rows[0].org_id : 'ORG001';
      
      // Insert app into tblApps (app_id is primary key, so only one entry needed)
      await dbPool.query(
        `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
         VALUES ($1, $2, $3, $4)`,
        [
          'COSTCENTERTRANSFER',
          'Cost Center Transfer',
          true,
          firstOrgId
        ]
      );
      console.log(`✅ Added COSTCENTERTRANSFER to tblApps`);
    } else {
      console.log(`ℹ️ COSTCENTERTRANSFER already exists in tblApps`);
    }
    
    // Step 2: Add to tblJobRoleNav for specific job roles (JR001, JR002, JR003, JR004)
    const targetJobRoles = ['JR001', 'JR002', 'JR003', 'JR004'];
    
    // Get specified job roles
    const jobRolesResult = await dbPool.query(
      'SELECT job_role_id, org_id FROM "tblJobRoles" WHERE int_status = 1 AND job_role_id = ANY($1)',
      [targetJobRoles]
    );
    const jobRoles = jobRolesResult.rows;
    
    console.log(`Found ${jobRoles.length} job roles to update (${targetJobRoles.join(', ')})`);
    
    let addedCount = 0;
    for (const jobRole of jobRoles) {
      // Check if navigation item already exists
      const checkNav = await dbPool.query(
        'SELECT job_role_nav_id FROM "tblJobRoleNav" WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1',
        [jobRole.job_role_id, 'COSTCENTERTRANSFER']
      );
      
      if (checkNav.rows.length === 0) {
        // Find the parent navigation item (ASSETASSIGNMENT)
        const parentNav = await dbPool.query(
          'SELECT job_role_nav_id FROM "tblJobRoleNav" WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1',
          [jobRole.job_role_id, 'ASSETASSIGNMENT']
        );
        
        let parent_id = null;
        if (parentNav.rows.length > 0) {
          parent_id = parentNav.rows[0].job_role_nav_id;
          console.log(`Found parent ASSETASSIGNMENT for job role ${jobRole.job_role_id}: ${parent_id}`);
        } else {
          console.log(`⚠️  No ASSETASSIGNMENT parent found for job role ${jobRole.job_role_id}, creating as top-level item`);
        }
        
        // Generate job_role_nav_id
        const job_role_nav_id = await generateCustomId('job_role_nav', 3);
        
        // Get max sequence for this job role and parent
        const maxSeqResult = await dbPool.query(
          parent_id 
            ? 'SELECT COALESCE(MAX(sequence), 0) as max_seq FROM "tblJobRoleNav" WHERE job_role_id = $1 AND parent_id = $2'
            : 'SELECT COALESCE(MAX(sequence), 0) as max_seq FROM "tblJobRoleNav" WHERE job_role_id = $1 AND parent_id IS NULL',
          parent_id ? [jobRole.job_role_id, parent_id] : [jobRole.job_role_id]
        );
        const nextSeq = (maxSeqResult.rows[0]?.max_seq || 0) + 1;
        
        // Insert into tblJobRoleNav
        await dbPool.query(
          `INSERT INTO "tblJobRoleNav" 
           (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status, org_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            job_role_nav_id,
            jobRole.job_role_id,
            parent_id, // parent_id - child of ASSETASSIGNMENT
            'COSTCENTERTRANSFER',
            'Cost Center Transfer',
            false, // is_group
            nextSeq,
            'V', // access_level - View access (can be changed to 'A' for Admin, 'E' for Edit)
            'D', // mob_desk - Desktop
            1, // int_status - Active
            jobRole.org_id // org_id
          ]
        );
        addedCount++;
        console.log(`✅ Added COSTCENTERTRANSFER to tblJobRoleNav for job role ${jobRole.job_role_id}${parent_id ? ' (child of ASSETASSIGNMENT)' : ''}`);
      } else {
        console.log(`ℹ️ COSTCENTERTRANSFER already exists in tblJobRoleNav for job role ${jobRole.job_role_id}`);
      }
    }
    
    console.log('✅ Migration completed successfully');
    console.log(`📊 Summary: Added ${addedCount} navigation entries to tblJobRoleNav`);
    console.log('📝 Note: The Cost Center Transfer app will appear under Asset Assignment in the navigation sidebar for job roles: JR001, JR002, JR003, JR004');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addCostCenterTransferApp()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addCostCenterTransferApp;
