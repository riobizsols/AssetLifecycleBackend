/**
 * Migration: Normalize legacy "V" (view) access_level to "D" (read-only) in tblJobRoleNav.
 * The web frontend treats both as view access; "D" is the canonical value.
 */

const { getDbFromContext } = require("../utils/dbContext");

const getDb = () => getDbFromContext();

const fixViewAccessLevelInNav = async () => {
  const dbPool = getDb();

  try {
    console.log('Starting migration: fix view access_level "V" -> "D" in tblJobRoleNav...');

    const result = await dbPool.query(
      `UPDATE "tblJobRoleNav"
       SET access_level = 'D'
       WHERE access_level = 'V' AND int_status = 1
       RETURNING job_role_nav_id, job_role_id, app_id`
    );

    console.log(`Updated ${result.rowCount} navigation row(s).`);
    result.rows.forEach((row) => {
      console.log(`  - ${row.job_role_nav_id} (${row.job_role_id} / ${row.app_id})`);
    });

    console.log("Migration completed.");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

if (require.main === module) {
  fixViewAccessLevelInNav()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = fixViewAccessLevelInNav;
