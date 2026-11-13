#!/usr/bin/env node
/**
 * Seed Upcoming Maintenance Schedule report app + Reports nav for all orgs.
 *
 * Usage:
 *   node scripts/seed-upcoming-maintenance-schedule-report-nav.js
 *   node scripts/seed-upcoming-maintenance-schedule-report-nav.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const APP_ID = 'UPCOMINGMAINTENANCESCHEDULE';
const APP_LABEL = 'Upcoming Maintenance Schedule';
const SYSTEM_USER = 'SETUP';
const isDryRun = process.argv.includes('--dry-run');

async function getNextId(client, table, column, prefix, pad = 3) {
  const result = await client.query(
    `
      SELECT ${column}
        FROM "${table}"
       WHERE ${column} ~ $1
       ORDER BY CAST(SUBSTRING(${column} FROM ${prefix.length + 1}) AS INTEGER) DESC
       LIMIT 1
    `,
    [`^${prefix}[0-9]+$`],
  );
  if (!result.rows.length) return `${prefix}${String(1).padStart(pad, '0')}`;
  const last = result.rows[0][column];
  const match = String(last).match(/\d+$/);
  const next = match ? parseInt(match[0], 10) + 1 : 1;
  return `${prefix}${String(next).padStart(pad, '0')}`;
}

async function seedOrg(client, orgId, stats) {
  if (!isDryRun) {
    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ($1, $2, true, $3)
        ON CONFLICT (app_id) DO UPDATE
        SET text = EXCLUDED.text, int_status = true, org_id = EXCLUDED.org_id
      `,
      [APP_ID, APP_LABEL, orgId],
    );
  }
  stats.appsUpserted += 1;

  const historyNav = await client.query(
    `
      SELECT job_role_id, parent_id, access_level, org_id, mob_desk
        FROM "tblJobRoleNav"
       WHERE app_id IN ('MAINTENANCESTATUSREPORT', 'MAINTENANCEHISTORY')
    `,
  );

  const rows = historyNav.rows.length
    ? historyNav.rows
    : [
        {
          job_role_id: 'JR001',
          parent_id: 'JRN012',
          access_level: 'A',
          org_id: orgId,
          mob_desk: 'D',
        },
      ];

  const seenRoles = new Set();
  for (const row of rows) {
    const roleKey = `${row.job_role_id}|${row.org_id || orgId}`;
    if (seenRoles.has(roleKey)) continue;
    seenRoles.add(roleKey);

    const exists = await client.query(
      `
        SELECT 1 FROM "tblJobRoleNav"
         WHERE job_role_id = $1 AND app_id = $2
           AND COALESCE(org_id, '') = COALESCE($3, '')
         LIMIT 1
      `,
      [row.job_role_id, APP_ID, row.org_id || orgId],
    );
    if (exists.rows.length) {
      stats.navExisting += 1;
      continue;
    }
    if (isDryRun) {
      stats.navInserted += 1;
      continue;
    }

    const roleOrgId = row.org_id || orgId;
    let parentId = row.parent_id || null;
    // Never attach under another role's node; fall back to same-role Reports group or top-level.
    if (parentId) {
      const parent = await client.query(
        `
          SELECT job_role_id FROM "tblJobRoleNav"
           WHERE job_role_nav_id = $1 LIMIT 1
        `,
        [parentId],
      );
      if (!parent.rows.length || parent.rows[0].job_role_id !== row.job_role_id) {
        parentId = null;
      }
    }
    if (!parentId) {
      const reportsGroup = await client.query(
        `
          SELECT job_role_nav_id FROM "tblJobRoleNav"
           WHERE job_role_id = $1
             AND COALESCE(is_group, false) = true
             AND LOWER(COALESCE(label, '')) = 'reports'
             AND COALESCE(org_id, '') = COALESCE($2, '')
           LIMIT 1
        `,
        [row.job_role_id, roleOrgId],
      );
      parentId = reportsGroup.rows[0]?.job_role_nav_id || null;
    }

    const maxSeq = await client.query(
      parentId
        ? `
            SELECT COALESCE(MAX(sequence), 0)::int AS s
              FROM "tblJobRoleNav"
             WHERE job_role_id = $1 AND parent_id = $2
          `
        : `
            SELECT COALESCE(MAX(sequence), 0)::int AS s
              FROM "tblJobRoleNav"
             WHERE job_role_id = $1 AND parent_id IS NULL
          `,
      parentId ? [row.job_role_id, parentId] : [row.job_role_id],
    );
    const seq = (maxSeq.rows[0]?.s || 0) + 1;
    const jrnId = await getNextId(client, 'tblJobRoleNav', 'job_role_nav_id', 'JRN', 3);

    await client.query(
      `
        INSERT INTO "tblJobRoleNav"
          (job_role_nav_id, job_role_id, parent_id, app_id, label, sequence,
           access_level, is_group, org_id, int_status, mob_desk)
        VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, 1, $9)
      `,
      [
        jrnId,
        row.job_role_id,
        parentId,
        APP_ID,
        APP_LABEL,
        seq,
        row.access_level || 'A',
        roleOrgId,
        row.mob_desk || 'D',
      ],
    );
    stats.navInserted += 1;
  }
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const stats = { appsUpserted: 0, navInserted: 0, navExisting: 0, orgs: 0 };

  try {
    const orgs = await client.query(
      `SELECT DISTINCT org_id FROM "tblOrgs" WHERE COALESCE(int_status, 1) = 1 ORDER BY org_id`,
    );
    const orgRows = orgs.rows.length
      ? orgs.rows
      : (await client.query(`SELECT DISTINCT org_id FROM "tblApps" WHERE org_id IS NOT NULL`)).rows;

    for (const row of orgRows) {
      stats.orgs += 1;
      await seedOrg(client, row.org_id, stats);
    }

    console.log(
      `[${isDryRun ? 'DRY-RUN' : 'DONE'}] Upcoming Maintenance Schedule nav seed`,
      { ...stats, by: SYSTEM_USER },
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
