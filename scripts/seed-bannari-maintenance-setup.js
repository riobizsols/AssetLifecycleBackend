#!/usr/bin/env node

/**
 * Seed complete maintenance configuration for all Bannari orgs:
 * - Org masters (maint types/status, workflow steps, job roles, WF job-role mappings)
 * - Per asset type: scheduled frequency, workflow sequences, checklist items
 *
 * Usage:
 *   node scripts/seed-bannari-maintenance-setup.js
 *   node scripts/seed-bannari-maintenance-setup.js --dry-run
 *   node scripts/seed-bannari-maintenance-setup.js --org-id=BAN003
 */

require('dotenv').config();

const { Client } = require('pg');
const {
  DEFAULT_MAINT_TYPES,
  DEFAULT_MAINT_STATUS,
} = require('../constants/setupDefaults');

const TARGET_DATABASE = 'bannari_db';
const BANNARI_ORG_PREFIX = 'BAN';
const SYSTEM_USER = 'SYSTEM';

const SCHEDULED_MAINT_TYPE = 'MT002';
const SCHEDULED_FREQUENCY = 6;
const SCHEDULED_UOM = 'UOM003';
const SCHEDULED_TEXT = '6 Months Maintenance';
const MAINTAINED_BY = 'Vendor';

const MAINTENANCE_MANAGER_ROLE = 'JR002';
const TECHNICIAN_ROLE = 'JR003';

const MANAGER_APPS = new Set([
  'DASHBOARD', 'ASSETS', 'ASSETASSIGNMENT', 'WORKORDERMANAGEMENT',
  'MAINTENANCEAPPROVAL', 'SUPERVISORAPPROVAL', 'MAINTENANCESCHEDULE',
  'REPORTBREAKDOWN', 'MAINTENANCEHISTORY',
]);

const TECHNICIAN_APPS = new Set([
  'DASHBOARD', 'WORKORDERMANAGEMENT', 'REPORTBREAKDOWN',
  'MAINTENANCESCHEDULE', 'SUPERVISORAPPROVAL',
]);

const DEFAULT_CHECKLIST = [
  'Visual inspection completed',
  'Safety checks completed',
  'Equipment tested and operational',
  'Work area cleaned and secured',
  'Maintenance documentation updated',
];

const WORKFLOW_STEP_DEFS = [
  { suffix: '01', text: 'Supervisor Approval', seq: 10, escDays: 3, jobRoleId: MAINTENANCE_MANAGER_ROLE },
  { suffix: '02', text: 'Maintenance Manager Approval', seq: 20, escDays: 5, jobRoleId: MAINTENANCE_MANAGER_ROLE },
];

const isDryRun = process.argv.includes('--dry-run');
const orgFilter = process.argv.find((a) => a.startsWith('--org-id='))?.split('=')[1] || null;

function databaseNameFromUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).pathname.replace(/^\//, '').split('?')[0] || null;
  } catch {
    return null;
  }
}

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
  const match = last.match(/\d+$/);
  const next = match ? parseInt(match[0], 10) + 1 : 1;
  return `${prefix}${String(next).padStart(pad, '0')}`;
}

function wfStepId(orgId, suffix) {
  return `WFS-${orgId}-${suffix}`;
}

async function seedMaintTypes(client, orgId, stats) {
  for (const type of DEFAULT_MAINT_TYPES) {
    if (isDryRun) {
      stats.maintTypes += 1;
      continue;
    }
    const hoursRequired = type.id === 'MT002' ? 48.0 : 24.0;
    // Shared catalog IDs — do not rewrite org_id on conflict (that hid types from other orgs).
    const result = await client.query(
      `
        INSERT INTO "tblMaintTypes" (maint_type_id, org_id, text, int_status, hours_required)
        VALUES ($1, $2, $3, 1, $4)
        ON CONFLICT (maint_type_id) DO UPDATE
        SET text = EXCLUDED.text,
            int_status = 1,
            hours_required = COALESCE("tblMaintTypes".hours_required, EXCLUDED.hours_required)
        RETURNING (xmax = 0) AS inserted
      `,
      [type.id, orgId, type.name, hoursRequired],
    );
    stats.maintTypes += result.rows[0]?.inserted ? 1 : 0;
  }
}

async function seedMaintStatus(client, orgId, stats) {
  for (const status of DEFAULT_MAINT_STATUS) {
    if (isDryRun) {
      stats.maintStatus += 1;
      continue;
    }
    await client.query(
      `
        INSERT INTO "tblMaintStatus" (maint_status_id, org_id, text, int_status)
        VALUES ($1, $2, $3, 1)
        ON CONFLICT (maint_status_id) DO UPDATE
        SET text = EXCLUDED.text, int_status = 1
      `,
      [status.id, orgId, status.name],
    );
    stats.maintStatus += 1;
  }
}

async function getJr001Nav(client, orgId) {
  const { rows } = await client.query(
    `
      SELECT app_id, access_level, mob_desk, sequence, label, is_group, parent_id
        FROM "tblJobRoleNav"
       WHERE job_role_id = 'JR001' AND org_id = $1 AND int_status = 1
       ORDER BY sequence
    `,
    [orgId],
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

async function seedJobRoleWithNav(client, orgId, roleId, text, jobFunction, navItems, stats) {
  if (isDryRun) {
    stats.jobRoles += 1;
    stats.jobRoleNav += navItems.length;
    return;
  }

  await client.query(
    `
      INSERT INTO "tblJobRoles" (org_id, job_role_id, text, job_function, int_status)
      VALUES ($1, $2, $3, $4, 1)
      ON CONFLICT (job_role_id) DO UPDATE
      SET text = EXCLUDED.text, job_function = EXCLUDED.job_function, int_status = 1
    `,
    [orgId, roleId, text, jobFunction],
  );
  stats.jobRoles += 1;

  await client.query(
    `DELETE FROM "tblJobRoleNav" WHERE job_role_id = $1 AND org_id = $2`,
    [roleId, orgId],
  );

  let jrnNum = parseInt(
    (
      await client.query(
        `SELECT job_role_nav_id FROM "tblJobRoleNav"
          WHERE job_role_nav_id ~ '^JRN[0-9]+$'
          ORDER BY CAST(SUBSTRING(job_role_nav_id FROM 4) AS INTEGER) DESC
          LIMIT 1`,
      )
    ).rows[0]?.job_role_nav_id?.slice(3) || '0',
    10,
  ) + 1;

  for (const item of navItems) {
    const job_role_nav_id = `JRN${String(jrnNum).padStart(3, '0')}`;
    jrnNum += 1;
    await client.query(
      `
        INSERT INTO "tblJobRoleNav"
          (job_role_nav_id, job_role_id, app_id, access_level, mob_desk, sequence, org_id, int_status, label, is_group, parent_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10)
      `,
      [
        job_role_nav_id,
        roleId,
        item.app_id,
        item.access_level,
        item.mob_desk,
        item.sequence,
        orgId,
        item.label,
        item.is_group,
        item.parent_id,
      ],
    );
    stats.jobRoleNav += 1;
  }
}

async function seedWorkflowSteps(client, orgId, stats) {
  const stepIds = [];
  for (const def of WORKFLOW_STEP_DEFS) {
    const wfStepsId = wfStepId(orgId, def.suffix);
    stepIds.push({ ...def, wfStepsId });

    const exists = await client.query(
      `SELECT 1 FROM "tblWFSteps" WHERE wf_steps_id = $1 LIMIT 1`,
      [wfStepsId],
    );
    if (exists.rows.length) continue;

    if (isDryRun) {
      stats.wfSteps += 1;
      continue;
    }

    await client.query(
      `
        INSERT INTO "tblWFSteps" (wf_steps_id, org_id, text, esc_no_days)
        VALUES ($1, $2, $3, $4)
      `,
      [wfStepsId, orgId, def.text, def.escDays],
    );
    stats.wfSteps += 1;
  }
  return stepIds;
}

async function seedWorkflowJobRoles(client, orgId, stepDefs, stats) {
  for (const def of stepDefs) {
    const exists = await client.query(
      `
        SELECT 1 FROM "tblWFJobRole"
         WHERE wf_steps_id = $1 AND org_id = $2 AND job_role_id = $3
         LIMIT 1
      `,
      [def.wfStepsId, orgId, def.jobRoleId],
    );
    if (exists.rows.length) continue;

    if (isDryRun) {
      stats.wfJobRoles += 1;
      continue;
    }

    const wfJobRoleId = await getNextId(client, 'tblWFJobRole', 'wf_job_role_id', 'WFJR', 3);

    await client.query(
      `
        INSERT INTO "tblWFJobRole" (wf_job_role_id, wf_steps_id, job_role_id, emp_int_id, org_id)
        VALUES ($1, $2, $3, NULL, $4)
      `,
      [wfJobRoleId, def.wfStepsId, def.jobRoleId, orgId],
    );
    stats.wfJobRoles += 1;
  }
}

async function upsertMaintFrequency(client, orgId, assetTypeId, stats) {
  const existing = await client.query(
    `
      SELECT at_main_freq_id
        FROM "tblATMaintFreq"
       WHERE asset_type_id = $1 AND org_id = $2
       ORDER BY at_main_freq_id
       LIMIT 1
    `,
    [assetTypeId, orgId],
  );

  if (existing.rows.length) {
    if (isDryRun) {
      stats.maintFreqUpdated += 1;
      return existing.rows[0].at_main_freq_id;
    }
    await client.query(
      `
        UPDATE "tblATMaintFreq"
           SET frequency = $3,
               uom = $4,
               text = $5,
               maintained_by = $6,
               maint_type_id = $7,
               int_status = 1,
               is_recurring = true
         WHERE at_main_freq_id = $1 AND org_id = $2
      `,
      [
        existing.rows[0].at_main_freq_id,
        orgId,
        SCHEDULED_FREQUENCY,
        SCHEDULED_UOM,
        SCHEDULED_TEXT,
        MAINTAINED_BY,
        SCHEDULED_MAINT_TYPE,
      ],
    );
    await client.query(
      `UPDATE "tblAssetTypes" SET required_maint = true WHERE asset_type_id = $1 AND org_id = $2`,
      [assetTypeId, orgId],
    );
    stats.maintFreqUpdated += 1;
    return existing.rows[0].at_main_freq_id;
  }

  if (isDryRun) {
    stats.maintFreqInserted += 1;
    return 'ATMF_DRY';
  }

  const atMainFreqId = await getNextId(client, 'tblATMaintFreq', 'at_main_freq_id', 'ATMF', 3);

  await client.query(
    `
      INSERT INTO "tblATMaintFreq" (
        at_main_freq_id, asset_type_id, frequency, uom, text,
        maintained_by, maint_type_id, int_status, org_id, is_recurring, emp_int_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, true, NULL)
    `,
    [
      atMainFreqId,
      assetTypeId,
      SCHEDULED_FREQUENCY,
      SCHEDULED_UOM,
      SCHEDULED_TEXT,
      MAINTAINED_BY,
      SCHEDULED_MAINT_TYPE,
      orgId,
    ],
  );
  await client.query(
    `UPDATE "tblAssetTypes" SET required_maint = true WHERE asset_type_id = $1 AND org_id = $2`,
    [assetTypeId, orgId],
  );
  stats.maintFreqInserted += 1;
  return atMainFreqId;
}

async function seedWorkflowSequences(client, orgId, assetTypeId, stepDefs, stats) {
  for (const def of stepDefs) {
    const exists = await client.query(
      `
        SELECT 1 FROM "tblWFATSeqs"
         WHERE asset_type_id = $1 AND org_id = $2 AND wf_steps_id = $3
         LIMIT 1
      `,
      [assetTypeId, orgId, def.wfStepsId],
    );
    if (exists.rows.length) continue;

    if (isDryRun) {
      stats.wfAtSeqs += 1;
      continue;
    }

    const wfAtSeqId = await getNextId(client, 'tblWFATSeqs', 'wf_at_seqs_id', 'WFAS', 3);

    await client.query(
      `
        INSERT INTO "tblWFATSeqs" (wf_at_seqs_id, asset_type_id, wf_steps_id, seqs_no, org_id)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [wfAtSeqId, assetTypeId, def.wfStepsId, def.seq, orgId],
    );
    stats.wfAtSeqs += 1;
  }
}

async function seedChecklist(client, orgId, assetTypeId, atMainFreqId, stats) {
  for (const text of DEFAULT_CHECKLIST) {
    const exists = await client.query(
      `
        SELECT 1 FROM "tblATMaintCheckList"
         WHERE asset_type_id = $1 AND org_id = $2 AND at_main_freq_id = $3 AND text = $4
         LIMIT 1
      `,
      [assetTypeId, orgId, atMainFreqId, text],
    );
    if (exists.rows.length) continue;

    if (isDryRun) {
      stats.checklist += 1;
      continue;
    }

    const checklistId = await getNextId(
      client,
      'tblATMaintCheckList',
      'at_main_checklist_id',
      'ATMCL',
      3,
    );

    await client.query(
      `
        INSERT INTO "tblATMaintCheckList"
          (at_main_checklist_id, org_id, asset_type_id, text, at_main_freq_id)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [checklistId, orgId, assetTypeId, text, atMainFreqId],
    );
    stats.checklist += 1;
  }
}

async function assignMaintenanceRoleToUsers(client, orgId, stats) {
  const users = await client.query(
    `
      SELECT u.user_id
        FROM "tblUsers" u
       WHERE u.org_id = $1
         AND (
           u.email ILIKE '%maintenance%'
           OR u.email ILIKE '%.maint@%'
           OR u.email ILIKE '%.maint.%'
         )
         AND NOT EXISTS (
           SELECT 1 FROM "tblUserJobRoles" ujr
            WHERE ujr.user_id = u.user_id AND ujr.job_role_id = $2
         )
    `,
    [orgId, MAINTENANCE_MANAGER_ROLE],
  );

  for (const row of users.rows) {
    if (isDryRun) {
      stats.userRoleAssignments += 1;
      continue;
    }
    const ujrId = await getNextId(client, 'tblUserJobRoles', 'user_job_role_id', 'UJR', 3);
    await client.query(
      `INSERT INTO "tblUserJobRoles" (user_job_role_id, user_id, job_role_id) VALUES ($1, $2, $3)`,
      [ujrId, row.user_id, MAINTENANCE_MANAGER_ROLE],
    );
    stats.userRoleAssignments += 1;
  }
}

async function seedOrg(client, orgId, orgName) {
  const stats = {
    maintTypes: 0,
    maintStatus: 0,
    jobRoles: 0,
    jobRoleNav: 0,
    wfSteps: 0,
    wfJobRoles: 0,
    maintFreqInserted: 0,
    maintFreqUpdated: 0,
    wfAtSeqs: 0,
    checklist: 0,
    userRoleAssignments: 0,
    assetTypes: 0,
  };

  console.log(`\n── ${orgId}: ${orgName} ──`);

  await seedMaintTypes(client, orgId, stats);
  await seedMaintStatus(client, orgId, stats);

  const jr001Nav = await getJr001Nav(client, orgId);
  if (!jr001Nav.length) {
    console.warn(`  ⚠ No JR001 navigation for ${orgId}; skipping JR002/JR003 nav seed`);
  } else {
    await seedJobRoleWithNav(
      client,
      orgId,
      MAINTENANCE_MANAGER_ROLE,
      'Maintenance Manager',
      'Approves maintenance workflows and work orders',
      pickNavItems(jr001Nav, MANAGER_APPS, 'A'),
      stats,
    );
    await seedJobRoleWithNav(
      client,
      orgId,
      TECHNICIAN_ROLE,
      'Maintenance Technician',
      'Executes maintenance and breakdown work orders',
      pickNavItems(jr001Nav, TECHNICIAN_APPS, 'A'),
      stats,
    );
  }

  const stepDefs = await seedWorkflowSteps(client, orgId, stats);
  await seedWorkflowJobRoles(client, orgId, stepDefs, stats);
  await assignMaintenanceRoleToUsers(client, orgId, stats);

  const assetTypes = await client.query(
    `
      SELECT asset_type_id, text
        FROM "tblAssetTypes"
       WHERE org_id = $1 AND int_status = 1
       ORDER BY text
    `,
    [orgId],
  );

  for (const assetType of assetTypes.rows) {
    stats.assetTypes += 1;
    const atMainFreqId = await upsertMaintFrequency(
      client,
      orgId,
      assetType.asset_type_id,
      stats,
    );
    await seedWorkflowSequences(client, orgId, assetType.asset_type_id, stepDefs, stats);
    if (atMainFreqId) {
      await seedChecklist(client, orgId, assetType.asset_type_id, atMainFreqId, stats);
    }
  }

  console.log(
    `  ${isDryRun ? '[dry-run] ' : ''}` +
      `${stats.assetTypes} asset types | ` +
      `freq +${stats.maintFreqInserted} ~${stats.maintFreqUpdated} | ` +
      `wf steps +${stats.wfSteps} | wf job roles +${stats.wfJobRoles} | ` +
      `sequences +${stats.wfAtSeqs} | checklist +${stats.checklist} | ` +
      `user role assigns +${stats.userRoleAssignments}`,
  );

  return stats;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const dbName = databaseNameFromUrl(connectionString);
  if (dbName !== TARGET_DATABASE) {
    throw new Error(
      `Refusing to run: expected database ${TARGET_DATABASE}, got ${dbName || 'unknown'}`,
    );
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const orgParams = orgFilter ? [orgFilter] : [`${BANNARI_ORG_PREFIX}%`];
    const orgClause = orgFilter ? 'org_id = $1' : 'org_id LIKE $1';
    const orgs = await client.query(
      `SELECT org_id, text FROM "tblOrgs" WHERE ${orgClause} ORDER BY org_id`,
      orgParams,
    );

    if (!orgs.rows.length) {
      console.log('No matching Bannari orgs found.');
      return;
    }

    console.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Seeding complete maintenance setup for ${orgs.rows.length} org(s)...`,
    );

    if (!isDryRun) await client.query('BEGIN');

    const totals = {
      assetTypes: 0,
      maintFreqInserted: 0,
      maintFreqUpdated: 0,
      wfSteps: 0,
      wfJobRoles: 0,
      wfAtSeqs: 0,
      checklist: 0,
      userRoleAssignments: 0,
    };

    for (const org of orgs.rows) {
      const stats = await seedOrg(client, org.org_id, org.text);
      Object.keys(totals).forEach((key) => {
        totals[key] += stats[key] || 0;
      });
    }

    if (!isDryRun) await client.query('COMMIT');

    console.log('\n════════════════════════════════════════');
    console.log(isDryRun ? 'Dry run complete.' : 'Maintenance setup complete.');
    console.log(`  Asset types processed: ${totals.assetTypes}`);
    console.log(`  Frequencies inserted:  ${totals.maintFreqInserted}`);
    console.log(`  Frequencies updated:   ${totals.maintFreqUpdated}`);
    console.log(`  Workflow steps:        ${totals.wfSteps}`);
    console.log(`  WF job-role mappings:  ${totals.wfJobRoles}`);
    console.log(`  WF asset-type seqs:    ${totals.wfAtSeqs}`);
    console.log(`  Checklist items:       ${totals.checklist}`);
    console.log(`  User role assignments: ${totals.userRoleAssignments}`);
    console.log('════════════════════════════════════════\n');
  } catch (error) {
    if (!isDryRun) await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
