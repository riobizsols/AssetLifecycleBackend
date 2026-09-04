#!/usr/bin/env node
/**
 * Register BRANCHDEPTMAPPING in tblApps + tblJobRoleNav (Master Data menu)
 * for every job role that already has BRANCHES access.
 *
 * Usage: node scripts/seed-branch-dept-mapping-nav.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { ensureBrDeptSchema } = require('../utils/ensureBrDeptSchema');

const APP_ID = 'BRANCHDEPTMAPPING';
const APP_LABEL = 'Branch – Department Mapping';
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

async function ensureApps(client) {
  const orgs = await client.query(`SELECT DISTINCT org_id FROM "tblApps" WHERE org_id IS NOT NULL`);
  for (const { org_id } of orgs.rows) {
    await client.query(
      `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
       VALUES ($1, $2, true, $3)
       ON CONFLICT (app_id) DO UPDATE SET text = EXCLUDED.text, int_status = true`,
      [APP_ID, APP_LABEL, org_id]
    );
  }
  console.log(`  ✓ tblApps ${APP_ID} for ${orgs.rows.length} org(s)`);
}

async function ensureNavForRole(client, branchesRow) {
  const {
    job_role_id,
    parent_id,
    sequence,
    access_level,
    org_id,
  } = branchesRow;

  const exists = await client.query(
    `SELECT job_role_nav_id FROM "tblJobRoleNav"
     WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1 LIMIT 1`,
    [job_role_id, APP_ID]
  );
  if (exists.rows.length) {
    console.log(`  = ${job_role_id} already has ${APP_ID}`);
    return;
  }

  const navId = await nextNavId(client);
  const newSequence = Number(sequence || 0) + 1;

  await client.query(
    `INSERT INTO "tblJobRoleNav"
     (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status, org_id)
     VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8, 1, $9)`,
    [
      navId,
      job_role_id,
      parent_id,
      APP_ID,
      APP_LABEL,
      newSequence,
      access_level || 'A',
      MOB_DESK,
      org_id,
    ]
  );
  console.log(`  + ${job_role_id} ${APP_ID} (${navId}) seq=${newSequence} parent=${parent_id || 'top'}`);
}

(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  const client = await pool.connect();
  try {
    console.log('Ensuring tblBR_DEPT schema...');
    const schemaResult = await ensureBrDeptSchema(client);
    console.log('  tblBR_DEPT ready', schemaResult);

    console.log('Seeding BRANCHDEPTMAPPING app + navigation...');
    await ensureApps(client);

    const branchesNav = await client.query(
      `SELECT job_role_id, job_role_nav_id, parent_id, sequence, access_level, org_id
       FROM "tblJobRoleNav"
       WHERE app_id = 'BRANCHES' AND int_status = 1
       ORDER BY job_role_id`
    );

    if (!branchesNav.rows.length) {
      console.warn('No BRANCHES nav rows found — add BRANCHES access first.');
      return;
    }

    for (const row of branchesNav.rows) {
      await ensureNavForRole(client, row);
    }

    console.log('\nDone. Log out and log back in to refresh the Master Data menu.');
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
