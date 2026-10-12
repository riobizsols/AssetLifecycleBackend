#!/usr/bin/env node
/**
 * Register OPCCOMPONENTS ("Components") in tblApps + tblJobRoleNav under the
 * Master Data group for every NGP (ORG003) job role that already has BRANCHES.
 *
 * Usage: node scripts/seed-components-nav.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const APP_ID = 'OPCCOMPONENTS';
const APP_LABEL = 'Components';
const ORG_ID = 'ORG003';
const MOB_DESK = 'D';

async function nextNavId(client) {
  const { rows } = await client.query(`
    SELECT COALESCE(MAX(
      CASE
        WHEN job_role_nav_id ~ '^JRN[0-9]+$'
        THEN CAST(SUBSTRING(job_role_nav_id FROM 4) AS INTEGER)
        ELSE 0
      END
    ), 0) + 1 AS n
    FROM "tblJobRoleNav"
  `);
  return `JRN${String(rows[0].n).padStart(3, '0')}`;
}

async function syncNavSequence(client) {
  await client.query(`
    INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
    SELECT 'jobrolenav', 'JRN', COALESCE(MAX(CAST(SUBSTRING(job_role_nav_id FROM 4) AS INTEGER)), 0)
      FROM "tblJobRoleNav" WHERE job_role_nav_id ~ '^JRN[0-9]+$'
    ON CONFLICT (table_key) DO UPDATE
      SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
  `);
}

async function ensureNavForRole(client, branchesRow) {
  const { job_role_id, parent_id, access_level, org_id } = branchesRow;

  const exists = await client.query(
    `SELECT job_role_nav_id FROM "tblJobRoleNav"
     WHERE job_role_id = $1 AND app_id = $2 AND org_id = $3 AND mob_desk = $4 LIMIT 1`,
    [job_role_id, APP_ID, org_id, MOB_DESK]
  );
  if (exists.rows.length) {
    console.log(`  = ${job_role_id} already has ${APP_ID}`);
    return;
  }

  const seq = await client.query(
    `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_seq FROM "tblJobRoleNav"
     WHERE job_role_id = $1 AND parent_id IS NOT DISTINCT FROM $2 AND org_id = $3 AND mob_desk = $4`,
    [job_role_id, parent_id, org_id, MOB_DESK]
  );
  const navId = await nextNavId(client);

  await client.query(
    `INSERT INTO "tblJobRoleNav"
     (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status, org_id)
     VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8, 1, $9)`,
    [navId, job_role_id, parent_id, APP_ID, APP_LABEL, seq.rows[0].next_seq, access_level || 'A', MOB_DESK, org_id]
  );
  console.log(`  + ${job_role_id} ${APP_ID} (${navId}) seq=${seq.rows[0].next_seq} parent=${parent_id || 'top'}`);
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (app_id) DO UPDATE SET text = EXCLUDED.text, int_status = true`,
      [APP_ID, APP_LABEL, ORG_ID]
    );
    console.log(`  ✓ tblApps ${APP_ID}`);

    const branchesNav = await client.query(
      `SELECT n.job_role_id, n.parent_id, n.access_level, n.org_id, p.label AS group_label
       FROM "tblJobRoleNav" n
       LEFT JOIN "tblJobRoleNav" p ON p.job_role_nav_id = n.parent_id
       WHERE n.app_id = 'BRANCHES' AND n.int_status = 1 AND n.org_id = $1 AND n.mob_desk = $2
       ORDER BY n.job_role_id`,
      [ORG_ID, MOB_DESK]
    );

    if (!branchesNav.rows.length) {
      console.warn('No BRANCHES nav rows found for', ORG_ID);
    }

    for (const row of branchesNav.rows) {
      console.log(`  ${row.job_role_id}: Master Data group = ${row.group_label || '(top level)'}`);
      await ensureNavForRole(client, row);
    }

    await syncNavSequence(client);
    await client.query('COMMIT');
    console.log('\nDone. Log out and log back in to refresh the Master Data menu.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
