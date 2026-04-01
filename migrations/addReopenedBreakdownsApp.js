/**
 * Migration: Add REOPENEDBREAKDOWNS app to tblApps and tblJobRoleNav
 *
 * This migration adds:
 * 1) tblApps entry for REOPENEDBREAKDOWNS
 * 2) tblJobRoleNav entries for JR001, JR002, JR003, JR004
 */

const { getDbFromContext } = require("../utils/dbContext");
const { generateCustomId } = require("../utils/idGenerator");

const getDb = () => getDbFromContext();
const TARGET_APP_ID = "REOPENEDBREAKDOWNS";
const TARGET_LABEL = "Reopened Breakdowns";
const TARGET_ROLES = ["JR001", "JR002", "JR003", "JR004"];

const addReopenedBreakdownsApp = async () => {
  const dbPool = getDb();

  try {
    console.log("Starting migration: Add REOPENEDBREAKDOWNS app...");

    // 1) Ensure app exists in tblApps
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

    // 2) Add nav access only for requested job roles
    const jobRolesResult = await dbPool.query(
      `SELECT job_role_id, org_id
       FROM "tblJobRoles"
       WHERE int_status = 1 AND job_role_id = ANY($1::text[])`,
      [TARGET_ROLES]
    );

    let addedCount = 0;
    for (const jobRole of jobRolesResult.rows) {
      const checkNav = await dbPool.query(
        `SELECT job_role_nav_id
         FROM "tblJobRoleNav"
         WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1`,
        [jobRole.job_role_id, TARGET_APP_ID]
      );

      if (checkNav.rows.length > 0) {
        console.log(
          `${TARGET_APP_ID} already exists in tblJobRoleNav for ${jobRole.job_role_id}`
        );
        continue;
      }

      const jobRoleNavId = await generateCustomId("job_role_nav", 3);
      const maxSeqResult = await dbPool.query(
        'SELECT COALESCE(MAX(sequence), 0) as max_seq FROM "tblJobRoleNav" WHERE job_role_id = $1',
        [jobRole.job_role_id]
      );
      const nextSeq = Number(maxSeqResult.rows[0]?.max_seq || 0) + 1;

      await dbPool.query(
        `INSERT INTO "tblJobRoleNav"
         (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status, org_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          jobRoleNavId,
          jobRole.job_role_id,
          null,
          TARGET_APP_ID,
          TARGET_LABEL,
          false,
          nextSeq,
          "V",
          "D",
          1,
          jobRole.org_id,
        ]
      );

      addedCount += 1;
      console.log(
        `Added ${TARGET_APP_ID} to tblJobRoleNav for ${jobRole.job_role_id}`
      );
    }

    console.log(`Migration completed. Added ${addedCount} job role nav rows.`);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

if (require.main === module) {
  addReopenedBreakdownsApp()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addReopenedBreakdownsApp;

