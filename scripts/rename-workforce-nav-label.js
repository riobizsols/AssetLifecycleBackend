/**
 * Rename WORKFORCEREPORT sidebar/nav label to Engineering Team Productivity Report.
 * Usage: node scripts/rename-workforce-nav-label.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const NEW_LABEL = 'Engineering Team Productivity Report';
const APP_ID = 'WORKFORCEREPORT';

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

async function renameInDb(label, connectionString) {
  const pool = new Pool({ connectionString, ssl: false });
  try {
    const apps = await pool.query(
      `UPDATE "tblApps" SET text = $1 WHERE app_id = $2 RETURNING app_id, text`,
      [NEW_LABEL, APP_ID],
    ).catch((e) => ({ rows: [], error: e.message }));

    const nav = await pool.query(
      `UPDATE "tblJobRoleNav"
       SET label = $1
       WHERE app_id = $2
          OR LOWER(TRIM(label)) = 'workforce'
       RETURNING job_role_nav_id, job_role_id, app_id, label, org_id`,
      [NEW_LABEL, APP_ID],
    ).catch((e) => ({ rows: [], error: e.message }));

    console.log(`\n=== ${label} ===`);
    if (apps.error) console.log('tblApps:', apps.error);
    else console.log('tblApps updated:', apps.rows);
    if (nav.error) console.log('tblJobRoleNav:', nav.error);
    else console.log(`tblJobRoleNav updated: ${nav.rows.length}`, nav.rows.slice(0, 8));
  } finally {
    await pool.end();
  }
}

(async () => {
  await renameInDb('master/DATABASE_URL', process.env.DATABASE_URL);
  for (const db of ['ngp_db', 'hospitality']) {
    try {
      await renameInDb(db, tenantUrl(db));
    } catch (e) {
      console.log(`skip ${db}:`, e.message);
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
