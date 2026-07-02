/**
 * Script: Add INSPECTIONCHECKLISTS to Navigation
 * Adds INSPECTIONCHECKLISTS to tblApps for all organizations
 * and to tblJobRoleNav for all job roles under MASTERDATA parent
 */

const { getDb } = require('./utils/dbContext');
const { generateCustomId } = require('./utils/idGenerator');
const { findAllGroupParents } = require('./utils/navigationParentUtils');

const getDbPool = () => getDb();

const addInspectionChecklistsNav = async () => {
  const dbPool = getDbPool();
  
  try {
    console.log('🚀 Starting: Add INSPECTIONCHECKLISTS to Navigation...\n');
    
    // First, clean up broken entries
    console.log('🧹 Cleaning up broken entries...');
    await dbPool.query(
      `DELETE FROM "tblJobRoleNav" WHERE "job_role_nav_id" = '' OR "job_role_nav_id" = '{}'`
    );
    console.log('   ✓ Cleaned\n');
    
    // Step 1: Check if already exists in tblApps
    console.log('📋 Step 1: Checking INSPECTIONCHECKLISTS in tblApps...');
    const appExistsCheck = await dbPool.query(
      'SELECT * FROM "tblApps" WHERE "app_id" = $1',
      ['INSPECTIONCHECKLISTS']
    );
    
    if (appExistsCheck.rows.length === 0) {
      const orgsResult = await dbPool.query('SELECT "org_id" FROM "tblOrgs" WHERE "int_status" = 1');
      const orgs = orgsResult.rows;
      console.log(`   Found ${orgs.length} organizations\n`);
      
      for (const org of orgs) {
        await dbPool.query(
          `INSERT INTO "tblApps" ("app_id", "org_id", "text", "int_status") 
           VALUES ($1, $2, $3, $4)`,
          ['INSPECTIONCHECKLISTS', org.org_id, 'Inspection Checklists', true]
        );
        console.log(`   ✓ Added to org: ${org.org_id}`);
      }
    } else {
      console.log('   ✓ Already in tblApps');
    }
    
    // Step 2–3: Add under Master Data group per job role
    console.log('\n📋 Step 2: Finding Master Data parents in tblJobRoleNav...');
    const jobRoles = await findAllGroupParents(dbPool, 'MASTERDATA');

    if (jobRoles.length === 0) {
      console.log('   ❌ Master Data parent not found in tblJobRoleNav');
      process.exit(1);
    }

    console.log(`   Found ${jobRoles.length} Master Data group(s)\n`);
    console.log('📋 Step 3: Adding INSPECTIONCHECKLISTS to tblJobRoleNav...');
    
    let totalAdded = 0;
    
    for (const role of jobRoles) {
      // Check if already exists
      const existsCheck = await dbPool.query(
        'SELECT * FROM "tblJobRoleNav" WHERE "app_id" = $1 AND "job_role_id" = $2',
        ['INSPECTIONCHECKLISTS', role.job_role_id]
      );
      
      if (existsCheck.rows.length === 0) {
        // Generate proper ID using the same method as admin-settings script
        const navId = await generateCustomId('job_role_nav', 3);
        
        await dbPool.query(
          `INSERT INTO "tblJobRoleNav" 
           ("job_role_nav_id", "job_role_id", "org_id", "parent_id", "app_id", "label", "sub_menu", "sequence", "access_level", "int_status", "is_group", "mob_desk")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            navId,
            role.job_role_id,
            role.org_id,
            role.job_role_nav_id,
            'INSPECTIONCHECKLISTS',
            'Inspection Checklists',
            null,
            999,
            'A',
            1,
            false,
            'D'
          ]
        );
        console.log(`   ✓ Added for job role: ${role.job_role_id} (ID: ${navId})`);
        totalAdded++;
      } else {
        console.log(`   ✓ Already exists for job role: ${role.job_role_id}`);
      }
    }
    
    console.log(`\n✅ INSPECTIONCHECKLISTS added to navigation successfully!`);
    console.log(`📊 Summary: Added ${totalAdded} navigation entries`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
};

addInspectionChecklistsNav();
