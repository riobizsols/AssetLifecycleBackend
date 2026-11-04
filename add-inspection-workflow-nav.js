/**
 * Script: Add INSPECTIONWORKFLOW to Navigation
 * Adds INSPECTIONWORKFLOW to tblApps for all organizations
 * and to tblJobRoleNav for all job roles under ADMINSETTINGS parent
 */

const { getDbFromContext } = require('./utils/dbContext');
const db = require('./config/db');

const getDbPool = () => {
  try {
    return getDbFromContext();
  } catch (err) {
    return db;
  }
};

const addInspectionWorkflowNav = async () => {
  const dbPool = getDbPool();

  try {
    console.log('🚀 Starting: Add INSPECTIONWORKFLOW to Navigation...\n');

    console.log('📋 Step 1: Checking INSPECTIONWORKFLOW in tblApps...');
    const appExistsCheck = await dbPool.query(
      'SELECT * FROM "tblApps" WHERE "app_id" = $1',
      ['INSPECTIONWORKFLOW']
    );

    if (appExistsCheck.rows.length === 0) {
      const orgsResult = await dbPool.query('SELECT "org_id" FROM "tblOrgs" WHERE "int_status" = 1');
      const orgs = orgsResult.rows;
      console.log(`   Found ${orgs.length} organizations\n`);

      for (const org of orgs) {
        await dbPool.query(
          `INSERT INTO "tblApps" ("app_id", "org_id", "text", "int_status")
           VALUES ($1, $2, $3, $4)`,
          ['INSPECTIONWORKFLOW', org.org_id, 'Inspection Workflow', true]
        );
        console.log(`   ✓ Added to org: ${org.org_id}`);
      }
    } else {
      console.log('   ✓ Already in tblApps');
    }

    console.log('\n📋 Step 2: Finding ADMINSETTINGS parent in tblJobRoleNav...');
    const jobRolesResult = await dbPool.query(
      'SELECT DISTINCT "job_role_id", "org_id", "job_role_nav_id" FROM "tblJobRoleNav" WHERE "app_id" = $1',
      ['ADMINSETTINGS']
    );

    if (jobRolesResult.rows.length === 0) {
      console.log('   ❌ ADMINSETTINGS parent not found in tblJobRoleNav');
      return;
    }

    const jobRoles = jobRolesResult.rows;
    console.log(`   Found ${jobRoles.length} instances of ADMINSETTINGS across roles\n`);

    console.log('📋 Step 3: Adding INSPECTIONWORKFLOW to tblJobRoleNav...');
    let totalAdded = 0;

    for (const role of jobRoles) {
      const existsCheck = await dbPool.query(
        'SELECT * FROM "tblJobRoleNav" WHERE "app_id" = $1 AND "job_role_id" = $2 AND "org_id" = $3',
        ['INSPECTIONWORKFLOW', role.job_role_id, role.org_id]
      );

      if (existsCheck.rows.length === 0) {
        const navId = 'iwf_' + Math.random().toString(36).substr(2, 9);

        await dbPool.query(
          `INSERT INTO "tblJobRoleNav"
           ("job_role_nav_id", "job_role_id", "org_id", "parent_id", "app_id", "label", "sub_menu", "sequence", "access_level", "int_status", "is_group", "mob_desk")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            navId,
            role.job_role_id,
            role.org_id,
            role.job_role_nav_id,
            'INSPECTIONWORKFLOW',
            'Inspection Workflow',
            null,
            18,
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

addInspectionWorkflowNav();
