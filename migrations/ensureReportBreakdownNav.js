/**
 * Ensures REPORTBREAKDOWN and EMPLOYEE REPORT BREAKDOWN exist in tblJobRoleNav
 * for every job role that already has REOPENEDBREAKDOWNS and/or REPORTBREAKDOWN.
 */

const { getDbFromContext } = require("../utils/dbContext");
const { generateCustomId } = require("../utils/idGenerator");

const getDb = () => getDbFromContext();

const APPS_TO_ENSURE = [
  { app_id: "REPORTBREAKDOWN", label: "Report Breakdown", sequenceOffset: 0 },
  {
    app_id: "EMPLOYEE REPORT BREAKDOWN",
    label: "Employee Report Breakdown",
    sequenceOffset: 1,
  },
];

const ensureReportBreakdownNav = async () => {
  const dbPool = getDb();

  try {
    console.log("Starting migration: ensure Report Breakdown navigation...");

    for (const app of APPS_TO_ENSURE) {
      const checkApp = await dbPool.query(
        'SELECT app_id FROM "tblApps" WHERE app_id = $1',
        [app.app_id]
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
          [app.app_id, app.label, true, firstOrgId]
        );
        console.log(`Added ${app.app_id} to tblApps`);
      }
    }

    const roleRows = await dbPool.query(
      `SELECT DISTINCT job_role_id, org_id
       FROM "tblJobRoleNav"
       WHERE int_status = 1
         AND app_id IN ('REPORTBREAKDOWN', 'REOPENEDBREAKDOWNS', 'EMPLOYEE REPORT BREAKDOWN')`
    );

    let addedCount = 0;
    for (const role of roleRows.rows) {
      const accessResult = await dbPool.query(
        `SELECT app_id, access_level, sequence, mob_desk
         FROM "tblJobRoleNav"
         WHERE job_role_id = $1
           AND int_status = 1
           AND app_id IN ('REPORTBREAKDOWN', 'REOPENEDBREAKDOWNS', 'EMPLOYEE REPORT BREAKDOWN')
         ORDER BY sequence`,
        [role.job_role_id]
      );

      const source =
        accessResult.rows.find((row) => row.app_id === "REPORTBREAKDOWN") ||
        accessResult.rows.find((row) => row.app_id === "REOPENEDBREAKDOWNS") ||
        accessResult.rows.find(
          (row) => row.app_id === "EMPLOYEE REPORT BREAKDOWN"
        );

      if (!source) continue;

      const baseSeq = Number(source.sequence || 11);
      const accessLevel =
        source.access_level === "V" ? "D" : source.access_level || "D";

      for (const app of APPS_TO_ENSURE) {
        const exists = await dbPool.query(
          `SELECT job_role_nav_id
           FROM "tblJobRoleNav"
           WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1`,
          [role.job_role_id, app.app_id]
        );

        if (exists.rows.length > 0) continue;

        const jobRoleNavId = await generateCustomId("job_role_nav", 3);
        await dbPool.query(
          `INSERT INTO "tblJobRoleNav"
           (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status, org_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            jobRoleNavId,
            role.job_role_id,
            null,
            app.app_id,
            app.label,
            false,
            baseSeq + app.sequenceOffset,
            accessLevel,
            source.mob_desk || "D",
            1,
            role.org_id,
          ]
        );

        addedCount += 1;
        console.log(
          `Added ${app.app_id} for job role ${role.job_role_id} (${accessLevel})`
        );
      }
    }

    console.log(`Migration completed. Added ${addedCount} navigation row(s).`);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

if (require.main === module) {
  ensureReportBreakdownNav()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = ensureReportBreakdownNav;
