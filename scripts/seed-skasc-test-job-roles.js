#!/usr/bin/env node
/**
 * Seed test job roles in SKASC tenant for multi-tenant role testing.
 * Usage: node scripts/seed-skasc-test-job-roles.js
 * Cleanup: node scripts/seed-skasc-test-job-roles.js --cleanup
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const cleanup = process.argv.includes('--cleanup');
const ORG_ID = 'ORG001';
const CREATED_BY = 'SEED';

const base = process.env.TENANT_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/skasc_db$1');
const pool = new Pool({ connectionString: base, ssl: false });

const TEST_ROLES = [
  {
    job_role_id: 'JR002',
    text: 'Maintenance Manager',
    job_function: 'Approves maintenance and work orders',
  },
  {
    job_role_id: 'JR003',
    text: 'Maintenance Technician',
    job_function: 'Mobile work orders and breakdowns',
  },
  {
    job_role_id: 'JR004',
    text: 'Report Viewer',
    job_function: 'Read-only reports access',
  },
];

const MANAGER_APPS = new Set([
  'DASHBOARD',
  'ASSETS',
  'ASSETASSIGNMENT',
  'WORKORDERMANAGEMENT',
  'MAINTENANCEAPPROVAL',
  'SCRAPMAINTENANCEAPPROVAL',
  'SUPERVISORAPPROVAL',
  'INSPECTION',
  'INSPECTIONVIEW',
  'INSPECTIONAPPROVAL',
  'MAINTENANCESCHEDULE',
  'REPORTBREAKDOWN',
  'MAINTENANCEHISTORY',
  'ASSETREPORT',
  'ASSETLIFECYCLEREPORT',
  'BREAKDOWNHISTORY',
]);

const TECHNICIAN_APPS = new Set([
  'DASHBOARD',
  'WORKORDERMANAGEMENT',
  'REPORTBREAKDOWN',
  'INSPECTIONVIEW',
  'MAINTENANCESCHEDULE',
  'USAGEBASEDASSET',
]);

const VIEWER_APPS = new Set([
  'DASHBOARD',
  'ASSETREPORT',
  'ASSETLIFECYCLEREPORT',
  'MAINTENANCEHISTORY',
  'BREAKDOWNHISTORY',
  'ASSETVALUATION',
  'ASSETWORKFLOWHISTORY',
  'USAGEBASEDASSETREPORT',
  'SLAREPORT',
  'QAAUDITREPORT',
  'BREAKDOWNREOPENDETAILS',
  'REOPENEDBREAKDOWNS',
]);

async function getNextJrnId(client) {
  const idResult = await client.query(`
    SELECT job_role_nav_id FROM "tblJobRoleNav"
    ORDER BY CAST(SUBSTRING(job_role_nav_id FROM 'JRN([0-9]+)') AS INTEGER) DESC
    LIMIT 1
  `);
  let next = 1;
  if (idResult.rows.length > 0) {
    const match = idResult.rows[0].job_role_nav_id.match(/JRN(\d+)/);
    if (match) next = parseInt(match[1], 10) + 1;
  }
  return next;
}

async function getJr001Nav(client) {
  const { rows } = await client.query(
    `SELECT jrn.app_id, jrn.access_level, jrn.mob_desk, jrn.sequence,
            jrn.label, jrn.is_group, jrn.parent_id
     FROM "tblJobRoleNav" jrn
     WHERE jrn.job_role_id = 'JR001' AND jrn.org_id = $1 AND jrn.int_status = 1`,
    [ORG_ID]
  );
  return rows;
}

function pickNavItems(jr001Nav, appSet, accessLevel) {
  return jr001Nav
    .filter((n) => appSet.has(n.app_id))
    .map((n, i) => ({
      app_id: n.app_id,
      access_level: accessLevel,
      mob_desk: n.mob_desk,
      sequence: i + 1,
      label: n.label,
      is_group: n.is_group,
      parent_id: n.parent_id,
    }));
}

async function seedRole(client, role, navItems, jrnStart) {
  await client.query(
    `INSERT INTO "tblJobRoles" (org_id, job_role_id, text, job_function, int_status, notif_warranty, notif_scrap)
     VALUES ($1, $2, $3, $4, 1, false, false)
     ON CONFLICT (job_role_id) DO UPDATE
     SET text = EXCLUDED.text, job_function = EXCLUDED.job_function, int_status = 1`,
    [ORG_ID, role.job_role_id, role.text, role.job_function]
  );

  await client.query(
    `DELETE FROM "tblJobRoleNav" WHERE job_role_id = $1 AND org_id = $2`,
    [role.job_role_id, ORG_ID]
  );

  let jrnNum = jrnStart;
  for (const item of navItems) {
    const job_role_nav_id = `JRN${String(jrnNum).padStart(3, '0')}`;
    await client.query(
      `INSERT INTO "tblJobRoleNav"
       (job_role_nav_id, job_role_id, app_id, access_level, mob_desk, sequence, org_id, int_status, label, is_group, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10)`,
      [
        job_role_nav_id,
        role.job_role_id,
        item.app_id,
        item.access_level,
        item.mob_desk,
        item.sequence,
        ORG_ID,
        item.label,
        item.is_group,
        item.parent_id,
      ]
    );
    jrnNum += 1;
  }
  return jrnNum;
}

async function main() {
  const client = await pool.connect();
  try {
    if (cleanup) {
      await client.query('BEGIN');
      for (const role of TEST_ROLES) {
        await client.query(`DELETE FROM "tblJobRoleNav" WHERE job_role_id = $1 AND org_id = $2`, [
          role.job_role_id,
          ORG_ID,
        ]);
        await client.query(`DELETE FROM "tblJobRoles" WHERE job_role_id = $1 AND org_id = $2`, [
          role.job_role_id,
          ORG_ID,
        ]);
      }
      await client.query('COMMIT');
      console.log('Removed JR002, JR003, JR004 from skasc_db');
      return;
    }

    const jr001Nav = await getJr001Nav(client);
    if (!jr001Nav.length) {
      throw new Error('JR001 navigation not found — cannot derive permissions');
    }

    const roleNavMap = {
      JR002: pickNavItems(jr001Nav, MANAGER_APPS, 'A'),
      JR003: pickNavItems(jr001Nav, TECHNICIAN_APPS, 'A'),
      JR004: pickNavItems(jr001Nav, VIEWER_APPS, 'D'),
    };

    await client.query('BEGIN');
    let jrnStart = await getNextJrnId(client);

    for (const role of TEST_ROLES) {
      const navItems = roleNavMap[role.job_role_id];
      jrnStart = await seedRole(client, role, navItems, jrnStart);
      console.log(`Created ${role.job_role_id} (${role.text}) with ${navItems.length} nav items`);
    }

    await client.query('COMMIT');
    console.log('\nSKASC test job roles ready. Assign users via Master Data → User Roles → Assign Roles.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
