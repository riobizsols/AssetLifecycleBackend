#!/usr/bin/env node
/**
 * Seed facility asset types (Electrical, Plumbing, HVAC, Civil, Lifts,
 * Generators, Fire Systems, Campus Infrastructure), department mappings,
 * maintenance frequencies, and the Maintenance Status Report nav item.
 *
 * Usage:
 *   node scripts/seed-facility-maintenance.js
 *   node scripts/seed-facility-maintenance.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { FACILITY_ASSET_TYPES } = require('../constants/facilityMaintenance');

const SYSTEM_USER = 'SETUP';
const SCHEDULED_MAINT_TYPE = 'MT002';
const SCHEDULED_FREQUENCY = 6;
const SCHEDULED_UOM = 'UOM003';
const SCHEDULED_TEXT = '6 Months Maintenance';
const MAINTAINED_BY = 'Vendor';
const APP_ID = 'MAINTENANCESTATUSREPORT';
const APP_LABEL = 'Maintenance Status Report';

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
  const match = last.match(/\d+$/);
  const next = match ? parseInt(match[0], 10) + 1 : 1;
  return `${prefix}${String(next).padStart(pad, '0')}`;
}

function namesForType(def) {
  return [def.name, ...(def.existingPreferredNames || []), ...(def.aliases || [])]
    .map((n) => String(n).trim().toLowerCase())
    .filter(Boolean);
}

async function findExistingType(client, orgId, def) {
  const names = namesForType(def);
  const { rows } = await client.query(
    `
      SELECT asset_type_id, text
        FROM "tblAssetTypes"
       WHERE org_id = $1
         AND LOWER(TRIM(text)) = ANY($2::text[])
       ORDER BY asset_type_id
       LIMIT 1
    `,
    [orgId, names],
  );
  return rows[0] || null;
}

async function ensureAssetType(client, orgId, def, stats) {
  const existing = await findExistingType(client, orgId, def);
  if (existing) {
    if (!isDryRun) {
      await client.query(
        `
          UPDATE "tblAssetTypes"
             SET required_maint = true,
                 inspection_required = true,
                 assignment_type = 'department',
                 int_status = 1
           WHERE asset_type_id = $1 AND org_id = $2
        `,
        [existing.asset_type_id, orgId],
      );
    }
    stats.typesExisting += 1;
    return existing.asset_type_id;
  }

  if (isDryRun) {
    stats.typesInserted += 1;
    return `AT_DRY_${def.name}`;
  }

  const assetTypeId = await getNextId(client, 'tblAssetTypes', 'asset_type_id', 'AT', 3);
  await client.query(
    `
      INSERT INTO "tblAssetTypes"
        (org_id, asset_type_id, int_status, assignment_type, inspection_required, group_required,
         created_by, created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
         maint_lead_type, serial_num_format, last_gen_seq_no, depreciation_type, required_maint)
      VALUES
        ($1, $2, 1, 'department', true, false,
         $3, CURRENT_DATE, $3, CURRENT_DATE, $4, false, NULL,
         NULL, 1, 0, 'SL', true)
    `,
    [orgId, assetTypeId, SYSTEM_USER, def.name],
  );
  stats.typesInserted += 1;
  return assetTypeId;
}

async function ensureMaintFreq(client, orgId, assetTypeId, typeName, stats) {
  const existing = await client.query(
    `
      SELECT at_main_freq_id
        FROM "tblATMaintFreq"
       WHERE asset_type_id = $1 AND org_id = $2
       LIMIT 1
    `,
    [assetTypeId, orgId],
  );
  if (existing.rows.length) {
    stats.freqExisting += 1;
    return existing.rows[0].at_main_freq_id;
  }
  if (isDryRun) {
    stats.freqInserted += 1;
    return 'ATMF_DRY';
  }
  const freqId = await getNextId(client, 'tblATMaintFreq', 'at_main_freq_id', 'ATMF', 3);
  await client.query(
    `
      INSERT INTO "tblATMaintFreq" (
        at_main_freq_id, asset_type_id, frequency, uom, text,
        maintained_by, maint_type_id, int_status, org_id, is_recurring, emp_int_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, true, NULL)
    `,
    [
      freqId,
      assetTypeId,
      SCHEDULED_FREQUENCY,
      SCHEDULED_UOM,
      `${typeName} — ${SCHEDULED_TEXT}`,
      MAINTAINED_BY,
      SCHEDULED_MAINT_TYPE,
      orgId,
    ],
  );
  stats.freqInserted += 1;
  return freqId;
}

async function ensureProdServ(client, orgId, assetTypeId, typeName, stats) {
  const existing = await client.query(
    `
      SELECT prod_serv_id
        FROM "tblProdServs"
       WHERE org_id = $1 AND asset_type_id = $2
       LIMIT 1
    `,
    [orgId, assetTypeId],
  );
  if (existing.rows.length) {
    stats.prodServExisting += 1;
    return;
  }
  if (isDryRun) {
    stats.prodServInserted += 1;
    return;
  }
  const prodServId = await getNextId(client, 'tblProdServs', 'prod_serv_id', 'PS', 3);
  await client.query(
    `
      INSERT INTO "tblProdServs"
        (prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description)
      VALUES ($1, $2, $3, 'Generic', $4, 1, 'product', $5)
    `,
    [prodServId, orgId, assetTypeId, typeName, `${typeName} campus facility asset`],
  );
  stats.prodServInserted += 1;
}

async function mapToDepartments(client, orgId, assetTypeId, stats) {
  const depts = await client.query(
    `
      SELECT dept_id FROM "tblDepartments"
       WHERE org_id = $1 AND COALESCE(int_status, 1) = 1
    `,
    [orgId],
  );
  for (const dept of depts.rows) {
    const exists = await client.query(
      `
        SELECT 1 FROM "tblDeptAssetTypes"
         WHERE org_id = $1 AND dept_id = $2 AND asset_type_id = $3
         LIMIT 1
      `,
      [orgId, dept.dept_id, assetTypeId],
    );
    if (exists.rows.length) {
      stats.deptMapsExisting += 1;
      continue;
    }
    if (isDryRun) {
      stats.deptMapsInserted += 1;
      continue;
    }
    const mapId = await getNextId(client, 'tblDeptAssetTypes', 'dept_asset_type_id', 'DPTASS', 3);
    await client.query(
      `
        INSERT INTO "tblDeptAssetTypes" (
          dept_asset_type_id, dept_id, asset_type_id, org_id,
          created_by, created_on, changed_by, changed_on, int_status
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $5, CURRENT_DATE, 1)
      `,
      [mapId, dept.dept_id, assetTypeId, orgId, SYSTEM_USER],
    );
    stats.deptMapsInserted += 1;
  }
}

async function seedReportNav(client, orgId, stats) {
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
       WHERE app_id = 'MAINTENANCEHISTORY'
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

  for (const row of rows) {
    const exists = await client.query(
      `
        SELECT 1 FROM "tblJobRoleNav"
         WHERE job_role_id = $1 AND app_id = $2
         LIMIT 1
      `,
      [row.job_role_id, APP_ID],
    );
    if (exists.rows.length) {
      stats.navExisting += 1;
      continue;
    }
    if (isDryRun) {
      stats.navInserted += 1;
      continue;
    }

    const parentId = row.parent_id || 'JRN012';
    const maxSeq = await client.query(
      `
        SELECT COALESCE(MAX(sequence), 0)::int AS s
          FROM "tblJobRoleNav"
         WHERE job_role_id = $1 AND parent_id = $2
      `,
      [row.job_role_id, parentId],
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
        row.org_id || orgId,
        row.mob_desk || 'D',
      ],
    );
    stats.navInserted += 1;
  }
}

async function seedOrg(client, orgId) {
  const stats = {
    typesInserted: 0,
    typesExisting: 0,
    freqInserted: 0,
    freqExisting: 0,
    prodServInserted: 0,
    prodServExisting: 0,
    deptMapsInserted: 0,
    deptMapsExisting: 0,
    appsUpserted: 0,
    navInserted: 0,
    navExisting: 0,
  };

  for (const def of FACILITY_ASSET_TYPES) {
    const assetTypeId = await ensureAssetType(client, orgId, def, stats);
    await ensureMaintFreq(client, orgId, assetTypeId, def.name, stats);
    await ensureProdServ(client, orgId, assetTypeId, def.name, stats);
    await mapToDepartments(client, orgId, assetTypeId, stats);
  }

  await seedReportNav(client, orgId, stats);
  return stats;
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.TENANT_DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL or TENANT_DATABASE_URL is required');
  }

  const client = new Client({ connectionString, ssl: false });
  await client.connect();
  try {
    await client.query('BEGIN');
    const orgs = await client.query(
      `SELECT org_id, text FROM "tblOrgs" WHERE COALESCE(int_status, 1) = 1 ORDER BY org_id`,
    );
    if (!orgs.rows.length) throw new Error('No active organization found');

    for (const org of orgs.rows) {
      const stats = await seedOrg(client, org.org_id);
      console.log(`[${org.org_id}] ${org.text || ''}`, stats);
    }

    if (isDryRun) {
      await client.query('ROLLBACK');
      console.log('Dry run complete — no changes written');
    } else {
      await client.query('COMMIT');
      console.log('Facility maintenance types and report nav seeded');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
