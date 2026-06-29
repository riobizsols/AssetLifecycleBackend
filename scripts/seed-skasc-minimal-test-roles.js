#!/usr/bin/env node
/**
 * Seed JR002/JR003/JR004 in SKASC with desktop navigation for role testing.
 * All items use mob_desk = 'D' (desktop browser testing).
 * Usage: node scripts/seed-skasc-minimal-test-roles.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const ORG_ID = 'ORG001';

const base = process.env.TENANT_DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/skasc_db$1');
const pool = new Pool({ connectionString: base, ssl: false });

const ROLES = [
  {
    job_role_id: 'JR002',
    text: 'Maintenance Manager',
    job_function: 'Approves maintenance and assets',
  },
  {
    job_role_id: 'JR003',
    text: 'Maintenance Technician',
    job_function: 'Desktop testing — work orders and breakdowns',
  },
  {
    job_role_id: 'JR004',
    text: 'Report Viewer',
    job_function: 'Read-only reports access',
  },
];

const DESKTOP = 'D';

// Desktop-only menus for browser testing (mob_desk = D on every row)
const MINIMAL_NAV = {
  JR002: [
    { app_id: 'DASHBOARD', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'ASSETS', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'WORKORDERMANAGEMENT', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'MAINTENANCEAPPROVAL', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'SCRAPMAINTENANCEAPPROVAL', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'SUPERVISORAPPROVAL', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'INSPECTION', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'INSPECTIONVIEW', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'INSPECTIONAPPROVAL', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'MAINTENANCESCHEDULE', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'REPORTBREAKDOWN', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'REPORTS', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'ASSETREPORT', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'MAINTENANCEHISTORY', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'ASSETLIFECYCLEREPORT', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'BREAKDOWNHISTORY', access_level: 'D', mob_desk: DESKTOP },
  ],
  JR003: [
    { app_id: 'DASHBOARD', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'ASSETS', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'WORKORDERMANAGEMENT', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'REPORTBREAKDOWN', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'INSPECTIONVIEW', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'MAINTENANCESCHEDULE', access_level: 'A', mob_desk: DESKTOP },
    { app_id: 'MAINTENANCEHISTORY', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'BREAKDOWNHISTORY', access_level: 'D', mob_desk: DESKTOP },
  ],
  JR004: [
    { app_id: 'DASHBOARD', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'ASSETS', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'REPORTS', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'ASSETREPORT', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'ASSETLIFECYCLEREPORT', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'MAINTENANCEHISTORY', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'BREAKDOWNHISTORY', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'ASSETVALUATION', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'ASSETWORKFLOWHISTORY', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'USAGEBASEDASSETREPORT', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'SLAREPORT', access_level: 'D', mob_desk: DESKTOP },
    { app_id: 'QAAUDITREPORT', access_level: 'D', mob_desk: DESKTOP },
  ],
};

async function getNavMeta(client, navItems) {
  const appIds = [...new Set(navItems.map((n) => n.app_id))];
  const { rows } = await client.query(
    `SELECT jrn.app_id, jrn.label, jrn.is_group, jrn.parent_id, jrn.mob_desk, p.app_id AS parent_app_id
     FROM "tblJobRoleNav" jrn
     LEFT JOIN "tblJobRoleNav" p
       ON p.job_role_nav_id = jrn.parent_id
      AND p.job_role_id = 'JR001'
      AND p.org_id = $1
     WHERE jrn.job_role_id = 'JR001' AND jrn.org_id = $1 AND jrn.app_id = ANY($2)`,
    [ORG_ID, appIds]
  );

  const pickMeta = (appId, mobDesk = 'D') => {
    const candidates = rows.filter(
      (r) => r.app_id === appId && (r.mob_desk === mobDesk || r.mob_desk == null)
    );
    candidates.sort(
      (a, b) =>
        (a.mob_desk === mobDesk ? 0 : 1) - (b.mob_desk === mobDesk ? 0 : 1)
    );
    return candidates[0] || null;
  };

  const map = new Map();
  for (const item of navItems) {
    const picked = pickMeta(item.app_id, item.mob_desk || 'D');
    if (picked) map.set(item.app_id, picked);
  }

  const apps = await client.query(
    `SELECT app_id, text AS label FROM "tblApps" WHERE app_id = ANY($1)`,
    [appIds]
  );
  for (const a of apps.rows) {
    if (!map.has(a.app_id)) {
      map.set(a.app_id, {
        app_id: a.app_id,
        label: a.label,
        is_group: false,
        parent_id: null,
        parent_app_id: null,
      });
    }
  }
  return map;
}

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

async function upsertRole(client, role, navItems, jrnStart) {
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

  const meta = await getNavMeta(client, navItems);
  let jrnNum = jrnStart;
  const navIdByAppId = new Map();

  for (const [i, item] of navItems.entries()) {
    const m = meta.get(item.app_id) || {
      label: item.app_id,
      is_group: false,
      parent_app_id: null,
    };
    const job_role_nav_id = `JRN${String(jrnNum).padStart(3, '0')}`;
    await client.query(
      `INSERT INTO "tblJobRoleNav"
       (job_role_nav_id, job_role_id, app_id, access_level, mob_desk, sequence, org_id, int_status, label, is_group, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, NULL)`,
      [
        job_role_nav_id,
        role.job_role_id,
        item.app_id,
        item.access_level,
        item.mob_desk,
        i + 1,
        ORG_ID,
        m.label,
        m.is_group,
      ]
    );
    navIdByAppId.set(item.app_id, job_role_nav_id);
    jrnNum += 1;
  }

  for (const item of navItems) {
    const m = meta.get(item.app_id);
    const parentAppId = m?.parent_app_id;
    if (!parentAppId || !navIdByAppId.has(parentAppId)) continue;

    await client.query(
      `UPDATE "tblJobRoleNav"
       SET parent_id = $1
       WHERE job_role_id = $2 AND org_id = $3 AND app_id = $4`,
      [navIdByAppId.get(parentAppId), role.job_role_id, ORG_ID, item.app_id]
    );
  }

  return jrnNum;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let jrnStart = await getNextJrnId(client);
    for (const role of ROLES) {
      const nav = MINIMAL_NAV[role.job_role_id];
      jrnStart = await upsertRole(client, role, nav, jrnStart);
      console.log(`${role.job_role_id} ${role.text}: ${nav.length} nav items`);
    }
    await client.query('COMMIT');
    console.log('\nDone. Desktop test logins:');
    console.log('  JR002 Maintenance Manager  → mgr.test@skasc.test');
    console.log('  JR003 Maintenance Technician → tech.test@skasc.test');
    console.log('  JR004 Report Viewer        → viewer.test@skasc.test');
    console.log('(Log out and back in after reseed to refresh sidebar.)');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
