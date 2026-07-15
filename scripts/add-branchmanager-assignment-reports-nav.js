#!/usr/bin/env node
/**
 * Add Asset Assignment + Reports menu groups to JR021 (role used by
 * branchmanager@gmail.com) in pressana_db.
 *
 * Asset Assignment:
 *   - Department Assignment
 *   - Employee Assignment
 *   - Cost Center Transfer
 *
 * Reports (10):
 *   - Asset Lifecycle Report
 *   - Asset Report
 *   - Maintenance History of Asset
 *   - Asset Valuation
 *   - Asset Workflow History
 *   - Breakdown History
 *   - SLA Reports
 *   - QA Audit Report
 *   - Usage Based Asset Report
 *   - Reopened Breakdowns
 *
 * Usage: node scripts/add-branchmanager-assignment-reports-nav.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const baseUrl = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
const dbUrl = baseUrl.replace(/\/([^/?]+)(\?|$)/, '/pressana_db$2');

const JOB_ROLE_ID = 'JR021';
const ORG_ID = 'ORG001';
const ACCESS = 'A';
const MOB_DESK = 'D';

const ASSET_ASSIGNMENT_CHILDREN = [
  { app_id: 'DEPTASSIGNMENT', label: 'Department Assignment', sequence: 1 },
  { app_id: 'EMPASSIGNMENT', label: 'Employee Assignment', sequence: 2 },
  { app_id: 'COSTCENTERTRANSFER', label: 'Cost Center Transfer', sequence: 3 },
];

const REPORT_CHILDREN = [
  { app_id: 'ASSETLIFECYCLEREPORT', label: 'Asset Lifecycle Report', sequence: 1 },
  { app_id: 'ASSETREPORT', label: 'Asset Report', sequence: 2 },
  { app_id: 'MAINTENANCEHISTORY', label: 'Maintenance History of Asset', sequence: 3 },
  { app_id: 'ASSETVALUATION', label: 'Asset Valuation', sequence: 4 },
  { app_id: 'ASSETWORKFLOWHISTORY', label: 'Asset Workflow History', sequence: 5 },
  { app_id: 'BREAKDOWNHISTORY', label: 'Breakdown History', sequence: 6 },
  { app_id: 'SLAREPORT', label: 'SLA Reports', sequence: 7 },
  { app_id: 'QAAUDITREPORT', label: 'QA Audit Report', sequence: 8 },
  { app_id: 'USAGEBASEDASSETREPORT', label: 'Usage Based Asset Report', sequence: 9 },
  { app_id: 'REOPENEDBREAKDOWNS', label: 'Reopened Breakdowns', sequence: 10 },
];

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
  return `JRN${rows[0].n}`;
}

async function ensureApp(client, appId, label) {
  const exists = await client.query(
    'SELECT app_id FROM "tblApps" WHERE app_id = $1',
    [appId]
  );
  if (exists.rows.length) return;
  await client.query(
    `INSERT INTO "tblApps" (app_id, text, int_status, org_id)
     VALUES ($1, $2, true, $3)`,
    [appId, label, ORG_ID]
  );
  console.log(`  + tblApps ${appId}`);
}

async function findGroup(client, label) {
  const { rows } = await client.query(
    `SELECT job_role_nav_id
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1
       AND int_status = 1
       AND is_group = true
       AND LOWER(TRIM(label)) = LOWER(TRIM($2))
       AND parent_id IS NULL
     ORDER BY sequence
     LIMIT 1`,
    [JOB_ROLE_ID, label]
  );
  return rows[0]?.job_role_nav_id || null;
}

async function ensureGroup(client, label, sequence) {
  let id = await findGroup(client, label);
  if (id) {
    console.log(`  = group "${label}" exists (${id})`);
    return id;
  }
  id = await nextNavId(client);
  await client.query(
    `INSERT INTO "tblJobRoleNav"
     (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status, org_id)
     VALUES ($1, $2, NULL, NULL, $3, true, $4, $5, $6, 1, $7)`,
    [id, JOB_ROLE_ID, label, sequence, ACCESS, MOB_DESK, ORG_ID]
  );
  console.log(`  + group "${label}" (${id})`);
  return id;
}

async function ensureChild(client, parentId, item) {
  const exists = await client.query(
    `SELECT job_role_nav_id, parent_id
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1 AND app_id = $2 AND int_status = 1
     LIMIT 1`,
    [JOB_ROLE_ID, item.app_id]
  );

  if (exists.rows.length) {
    const row = exists.rows[0];
    if (row.parent_id !== parentId) {
      await client.query(
        `UPDATE "tblJobRoleNav"
         SET parent_id = $1, is_group = false, label = $2, sequence = $3, access_level = $4, mob_desk = $5
         WHERE job_role_nav_id = $6`,
        [parentId, item.label, item.sequence, ACCESS, MOB_DESK, row.job_role_nav_id]
      );
      console.log(`  ~ moved ${item.app_id} under parent ${parentId}`);
    } else {
      console.log(`  = ${item.app_id} already under group`);
    }
    return;
  }

  await ensureApp(client, item.app_id, item.label);
  const id = await nextNavId(client);
  await client.query(
    `INSERT INTO "tblJobRoleNav"
     (job_role_nav_id, job_role_id, parent_id, app_id, label, is_group, sequence, access_level, mob_desk, int_status, org_id)
     VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8, 1, $9)`,
    [
      id,
      JOB_ROLE_ID,
      parentId,
      item.app_id,
      item.label,
      item.sequence,
      ACCESS,
      MOB_DESK,
      ORG_ID,
    ]
  );
  console.log(`  + ${item.app_id} (${id})`);
}

async function nextTopSequence(client) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(sequence), 0) AS max_seq
     FROM "tblJobRoleNav"
     WHERE job_role_id = $1 AND parent_id IS NULL AND int_status = 1`,
    [JOB_ROLE_ID]
  );
  return Number(rows[0].max_seq || 0) + 1;
}

(async () => {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: false,
    max: 1,
    statement_timeout: 20000,
    query_timeout: 20000,
  });
  const client = await pool.connect();
  try {
    await client.query(`SET lock_timeout = '8s'`);
    console.log(`Adding Asset Assignment + Reports to ${JOB_ROLE_ID} (pressana_db)...`);

    const user = await client.query(
      `SELECT user_id, email, job_role_id FROM "tblUsers"
       WHERE LOWER(email) = 'branchmanager@gmail.com'`
    );
    console.log('Login user:', user.rows[0] || '(not found)');

    let topSeq = await nextTopSequence(client);

    const assignmentParent = await ensureGroup(client, 'Asset Assignment', topSeq++);
    for (const child of ASSET_ASSIGNMENT_CHILDREN) {
      await ensureChild(client, assignmentParent, child);
    }

    const reportsParent = await ensureGroup(client, 'Reports', topSeq++);
    for (const child of REPORT_CHILDREN) {
      await ensureChild(client, reportsParent, child);
    }

    const nav = await client.query(
      `SELECT job_role_nav_id, parent_id, app_id, label, is_group, sequence
       FROM "tblJobRoleNav"
       WHERE job_role_id = $1 AND int_status = 1
         AND (
           job_role_nav_id = ANY($2::text[])
           OR parent_id = ANY($2::text[])
         )
       ORDER BY parent_id NULLS FIRST, sequence, label`,
      [JOB_ROLE_ID, [assignmentParent, reportsParent]]
    );

    console.log('\nResulting menus:');
    for (const n of nav.rows) {
      const indent = n.parent_id ? '  - ' : '[GROUP] ';
      console.log(`${indent}${n.label}${n.app_id ? ` (${n.app_id})` : ''}`);
    }
    console.log('\nDone. Log out and log back in as branchmanager@gmail.com to see the menus.');
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
