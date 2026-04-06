/**
 * Migration: Add ONETIMECRON app to tblApps and tblJobRoleNav
 *
 * - Registers ONETIMECRON in tblApps once (app_id is PK; same pattern as REOPENEDBREAKDOWNS)
 * - Adds navigation for job roles JR001, JR002, JR003, JR004 with access_level A
 * - Places the item under Master Data (MASTERDATA) when that parent row exists
 *
 * Run: node migrations/addOneTimeCronApp.js
 * (from AssetLifecycleBackend with DATABASE_URL / .env loaded)
 */

const { getDbFromContext } = require("../utils/dbContext");
const { generateCustomId } = require("../utils/idGenerator");

const getDb = () => getDbFromContext();

const TARGET_APP_ID = "ONETIMECRON";
const TARGET_LABEL = "One Time Cron";
const TARGET_ROLES = ["JR001", "JR002", "JR003", "JR004"];
const PARENT_APP_ID = "MASTERDATA";

const addOneTimeCronApp = async () => {
  const dbPool = getDb();

  try {
    console.log("Starting migration: Add ONETIMECRON app...");

    const checkApp = await dbPool.query(
      'SELECT app_id FROM "tblApps" WHERE app_id = $1',
      [TARGET_APP_ID],
    );

    if (checkApp.rows.length === 0) {
      const orgResult = await dbPool.query(
        'SELECT org_id FROM "tblOrgs" WHERE int_status = 1 LIMIT 1',
      );
      const firstOrgId =
        orgResult.rows.length > 0 ? orgResult.rows[0].org_id : "ORG001";

      await dbPool.query(
        `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
         VALUES ($1, $2, $3, $4)`,
        [TARGET_APP_ID, TARGET_LABEL, true, firstOrgId],
      );
      console.log(`✅ Added ${TARGET_APP_ID} to tblApps`);
    } else {
      console.log(`ℹ️ ${TARGET_APP_ID} already exists in tblApps`);
    }

    const jobRolesResult = await dbPool.query(
      `SELECT job_role_id, org_id
       FROM "tblJobRoles"
       WHERE int_status = 1 AND job_role_id = ANY($1::text[])`,
      [TARGET_ROLES],
    );

    let addedCount = 0;
    for (const jobRole of jobRolesResult.rows) {
      const checkNav = await dbPool.query(
        `SELECT job_role_nav_id
         FROM "tblJobRoleNav"
         WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1`,
        [jobRole.job_role_id, TARGET_APP_ID],
      );

      if (checkNav.rows.length > 0) {
        console.log(
          `${TARGET_APP_ID} already in tblJobRoleNav for ${jobRole.job_role_id}`,
        );
        continue;
      }

      const parentNav = await dbPool.query(
        `SELECT job_role_nav_id
         FROM "tblJobRoleNav"
         WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1
         LIMIT 1`,
        [jobRole.job_role_id, PARENT_APP_ID],
      );

      let parent_id = null;
      if (parentNav.rows.length > 0) {
        parent_id = parentNav.rows[0].job_role_nav_id;
        console.log(
          `Parent ${PARENT_APP_ID} for ${jobRole.job_role_id}: ${parent_id}`,
        );
      } else {
        console.log(
          `⚠️ No ${PARENT_APP_ID} parent for ${jobRole.job_role_id}; inserting as top-level`,
        );
      }

      const jobRoleNavId = await generateCustomId("job_role_nav", 3);

      const maxSeqResult = await dbPool.query(
        parent_id
          ? `SELECT COALESCE(MAX(sequence), 0) AS max_seq
             FROM "tblJobRoleNav"
             WHERE job_role_id = $1 AND parent_id = $2`
          : `SELECT COALESCE(MAX(sequence), 0) AS max_seq
             FROM "tblJobRoleNav"
             WHERE job_role_id = $1 AND parent_id IS NULL`,
        parent_id
          ? [jobRole.job_role_id, parent_id]
          : [jobRole.job_role_id],
      );
      const nextSeq = Number(maxSeqResult.rows[0]?.max_seq || 0) + 1;

      await dbPool.query(
        `INSERT INTO "tblJobRoleNav"
         (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status, org_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          jobRoleNavId,
          jobRole.job_role_id,
          parent_id,
          TARGET_APP_ID,
          TARGET_LABEL,
          false,
          nextSeq,
          "A",
          "D",
          1,
          jobRole.org_id,
        ],
      );

      addedCount += 1;
      console.log(
        `✅ Added ${TARGET_APP_ID} to tblJobRoleNav for ${jobRole.job_role_id} (access A)`,
      );
    }

    console.log(`Migration completed. Added ${addedCount} job role nav row(s).`);
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

if (require.main === module) {
  addOneTimeCronApp()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addOneTimeCronApp;
