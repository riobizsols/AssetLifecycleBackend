/**
 * Move admin-only nav rows from Master Data (or top-level) under the Admin Settings group
 * for System Administrator on a tenant DB.
 *
 * Usage: node scripts/fix-admin-settings-nav-placement.js [db_name]
 */
require('dotenv').config();
const { Pool } = require('pg');

const ADMIN_ONLY_APP_IDS = [
  'USERROLES',
  'BULKSERIALNUMBERPRINT',
  'COLUMNACCESSCONFIG',
  'MAINTENANCECONFIG',
  'PROPERTIES',
  'BREAKDOWNREASONCODES',
  'ONETIMECRON',
  'JOBMONITOR',
  'AUDITLOGCONFIG',
  'TEXTMESSAGES',
];

const BASE = (process.env.DATABASE_URL || '').replace(/\/[^/]+$/, '');

async function fixDb(dbName) {
  const pool = new Pool({ connectionString: `${BASE}/${dbName}` });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roles = await client.query(
      `SELECT job_role_id FROM "tblJobRoles" WHERE text = 'System Administrator' LIMIT 1`
    );
    const jobRoleId = roles.rows[0]?.job_role_id;
    if (!jobRoleId) {
      console.log(`${dbName}: no System Administrator role — skipped`);
      await client.query('ROLLBACK');
      return;
    }

    const adminGroup = await client.query(
      `SELECT job_role_nav_id, sequence
       FROM "tblJobRoleNav"
       WHERE job_role_id = $1
         AND int_status = 1
         AND is_group = true
         AND LOWER(TRIM(label)) = 'admin settings'
       ORDER BY sequence
       LIMIT 1`,
      [jobRoleId]
    );
    const adminGroupId = adminGroup.rows[0]?.job_role_nav_id;
    if (!adminGroupId) {
      console.log(`${dbName}: no Admin Settings group for ${jobRoleId} — skipped`);
      await client.query('ROLLBACK');
      return;
    }

    const moved = await client.query(
      `UPDATE "tblJobRoleNav"
       SET parent_id = $1
       WHERE job_role_id = $2
         AND int_status = 1
         AND UPPER(app_id) = ANY($3::text[])
         AND (parent_id IS DISTINCT FROM $1)
       RETURNING job_role_nav_id, app_id, label`,
      [adminGroupId, jobRoleId, ADMIN_ONLY_APP_IDS.map((id) => id.toUpperCase())]
    );

    await client.query('COMMIT');
    console.log(
      `${dbName}: moved ${moved.rowCount} admin item(s) under ${adminGroupId}`,
      moved.rows.map((r) => r.app_id).join(', ') || '(none)'
    );
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const dbName = process.argv[2] || process.env.DATABASE_URL?.split('/').pop() || 'hospitality';
  await fixDb(dbName);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
