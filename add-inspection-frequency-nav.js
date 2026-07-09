/**
 * Script: Add INSPECTIONFREQUENCY to Navigation
 * Adds INSPECTIONFREQUENCY to tblApps for all organizations
 * and to tblJobRoleNav for all job roles under MASTERDATA parent
 */

const { getDbFromContext } = require('./utils/dbContext');
const db = require('./config/db');
const { findAllGroupParents } = require('./utils/navigationParentUtils');

const getDbPool = () => {
  try {
    return getDbFromContext();
  } catch (err) {
    return db;
  }
};

const addInspectionFrequencyNav = async () => {
  const dbPool = getDbPool();
  
  try {
    console.log('🚀 Starting: Add INSPECTIONFREQUENCY to Navigation...\n');
    
    // Step 1: Check if already exists in tblApps
    console.log('📋 Step 1: Checking INSPECTIONFREQUENCY in tblApps...');
    const appExistsCheck = await dbPool.query(
      'SELECT * FROM "tblApps" WHERE "app_id" = $1',
      ['INSPECTIONFREQUENCY']
    );
    
    if (appExistsCheck.rows.length === 0) {
      const orgsResult = await dbPool.query('SELECT "org_id" FROM "tblOrgs" WHERE "int_status" = 1');
      const orgs = orgsResult.rows;
      console.log(`   Found ${orgs.length} organizations\n`);
      
      for (const org of orgs) {
        await dbPool.query(
          `INSERT INTO "tblApps" ("app_id", "org_id", "text", "int_status") 
           VALUES ($1, $2, $3, $4)`,
          ['INSPECTIONFREQUENCY', org.org_id, 'Inspection Frequency', true]
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
      return;
    }

    console.log(`   Found ${jobRoles.length} Master Data group(s) across roles\n`);
    console.log('📋 Step 3: Adding INSPECTIONFREQUENCY to tblJobRoleNav...');
    
    let totalAdded = 0;
    
    for (const role of jobRoles) {
      // Check if already exists for this specific role
      const existsCheck = await dbPool.query(
        'SELECT * FROM "tblJobRoleNav" WHERE "app_id" = $1 AND "job_role_id" = $2 AND "org_id" = $3',
        ['INSPECTIONFREQUENCY', role.job_role_id, role.org_id]
      );
      
      if (existsCheck.rows.length === 0) {
        // Shorter ID to fit VARCHAR(20)
        const navId = 'ifn_' + Math.random().toString(36).substr(2, 9);
        
        await dbPool.query(
          `INSERT INTO "tblJobRoleNav" 
           ("job_role_nav_id", "job_role_id", "org_id", "parent_id", "app_id", "label", "sub_menu", "sequence", "access_level", "int_status", "is_group", "mob_desk")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            navId,
            role.job_role_id,
            role.org_id,
            role.job_role_nav_id, // MASTERDATA's own nav ID is the parent_id for children
            'INSPECTIONFREQUENCY',
            'Inspection Frequency',
            null,
            24, // Setting after other master data items
            'A',
            1,
            false,
            'D'
          ]
        );
        totalAdded++;
      }
    }
    
    console.log(`\n🎉 Completed! Added ${totalAdded} navigation entries.`);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    process.exit();
  }
};

addInspectionFrequencyNav();
