/**
 * Migration: Add EMPLOYEE REPORT BREAKDOWN app to tblApps and tblJobRoleNav
 *
 * Mirrors REPORTBREAKDOWN access for each job role that already has it.
 */

const { getDbFromContext } = require("../utils/dbContext");
const { generateCustomId } = require("../utils/idGenerator");

const getDb = () => getDbFromContext();

const TARGET_APP_ID = "EMPLOYEE REPORT BREAKDOWN";
const TARGET_LABEL = "Employee Report Breakdown";
const SOURCE_APP_ID = "REPORTBREAKDOWN";

const addEmployeeReportBreakdownApp = async () => {
  const dbPool = getDb();

  try {
    console.log("Starting migration: Add EMPLOYEE REPORT BREAKDOWN app...");

    const checkApp = await dbPool.query(
      'SELECT app_id FROM "tblApps" WHERE app_id = $1',
      [TARGET_APP_ID]
    );

    if (checkApp.rows.length === 0) {
      const orgResult = await dbPool.query(
        'SELECT org_id FROM "tblOrgs" WHERE int_status = 1 LIMIT 1'
      );
      const firstOrgId =
        orgResult.rows.length > 0 ? orgResult.rows[0].org_id : "ORG001";

      await dbPool.query(
        `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
         VALUES ($1, $2, $3, $4)`,
        [TARGET_APP_ID, TARGET_LABEL, true, firstOrgId]
      );
      console.log(`Added ${TARGET_APP_ID} to tblApps`);
    } else {
      console.log(`${TARGET_APP_ID} already exists in tblApps`);
    }

    const sourceNavResult = await dbPool.query(
      `SELECT job_role_id, org_id, access_level, sequence, mob_desk
       FROM "tblJobRoleNav"
       WHERE app_id = $1 AND int_status = 1`,
      [SOURCE_APP_ID]
    );

    let addedCount = 0;
    for (const sourceNav of sourceNavResult.rows) {
      const checkNav = await dbPool.query(
        `SELECT job_role_nav_id
         FROM "tblJobRoleNav"
         WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1`,
        [sourceNav.job_role_id, TARGET_APP_ID]
      );

      if (checkNav.rows.length > 0) {
        console.log(
          `${TARGET_APP_ID} already exists for job role ${sourceNav.job_role_id}`
        );
        continue;
      }

      const jobRoleNavId = await generateCustomId("job_role_nav", 3);

      await dbPool.query(
        `INSERT INTO "tblJobRoleNav"
         (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status, org_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          jobRoleNavId,
          sourceNav.job_role_id,
          null,
          TARGET_APP_ID,
          TARGET_LABEL,
          false,
          (sourceNav.sequence || 0) + 1,
          sourceNav.access_level === "V" ? "D" : sourceNav.access_level || "D",
          sourceNav.mob_desk || "D",
          1,
          sourceNav.org_id,
        ]
      );

      addedCount += 1;
      console.log(
        `Added ${TARGET_APP_ID} to tblJobRoleNav for job role ${sourceNav.job_role_id}`
      );
    }

    console.log(`Migration completed. Added ${addedCount} navigation row(s).`);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

if (require.main === module) {
  addEmployeeReportBreakdownApp()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addEmployeeReportBreakdownApp;
