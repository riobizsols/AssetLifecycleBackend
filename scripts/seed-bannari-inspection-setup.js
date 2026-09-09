#!/usr/bin/env node

/**
 * Seed complete inspection configuration for all Bannari orgs:
 * - Per org: inspection workflow steps, job-role mappings, master checklist questions
 * - Per asset type: inspection_required flag, checklist mapping, frequency, workflow sequences
 *
 * Usage:
 *   node scripts/seed-bannari-inspection-setup.js
 *   node scripts/seed-bannari-inspection-setup.js --dry-run
 *   node scripts/seed-bannari-inspection-setup.js --org-id=BAN003
 */

require('dotenv').config();

const { Client } = require('pg');

const TARGET_DATABASE = 'bannari_db';
const BANNARI_ORG_PREFIX = 'BAN';
const SYSTEM_USER = 'SYSTEM';
const MANAGER_ROLE = 'JR002';

const INSP_FREQUENCY = 6;
const INSP_UOM = 'UOM003';
const INSP_FREQ_TEXT = '6 Months Inspection';
const MAINTAINED_BY = 'Vendor';

const DEFAULT_QUESTIONS = [
  'Visual inspection completed',
  'Safety checks completed',
  'Equipment tested and operational',
  'No leaks or abnormal noise observed',
  'Inspection documentation updated',
];

const WORKFLOW_STEP_DEFS = [
  { suffix: '01', text: 'Supervisor Approval', seq: 10 },
  { suffix: '02', text: 'Inspection Manager Approval', seq: 20 },
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

function wfInspStepId(orgId, suffix) {
  return `WFIS-${orgId}-${suffix}`;
}

async function seedInspWorkflowSteps(client, orgId, stats) {
  const stepIds = [];
  for (const def of WORKFLOW_STEP_DEFS) {
    const wfInspStepsId = wfInspStepId(orgId, def.suffix);
    stepIds.push({ ...def, wfInspStepsId });

    const exists = await client.query(
      `SELECT 1 FROM "tblWFInspSteps" WHERE wf_insp_steps_id = $1 LIMIT 1`,
      [wfInspStepsId],
    );
    if (exists.rows.length) continue;

    if (isDryRun) {
      stats.wfInspSteps += 1;
      continue;
    }

    await client.query(
      `INSERT INTO "tblWFInspSteps" (wf_insp_steps_id, org_id, text) VALUES ($1, $2, $3)`,
      [wfInspStepsId, orgId, def.text],
    );
    stats.wfInspSteps += 1;
  }
  return stepIds;
}

async function resolveDefaultDeptId(client, orgId) {
  const preferred = await client.query(
    `
      SELECT dept_id
        FROM "tblDepartments"
       WHERE org_id = $1
         AND (
           text ILIKE '%maintenance%'
           OR text ILIKE '%engineering%'
           OR text ILIKE '%utilities%'
         )
       ORDER BY dept_id
       LIMIT 1
    `,
    [orgId],
  );
  if (preferred.rows.length) return preferred.rows[0].dept_id;

  const fallback = await client.query(
    `SELECT dept_id FROM "tblDepartments" WHERE org_id = $1 ORDER BY dept_id LIMIT 1`,
    [orgId],
  );
  if (!fallback.rows.length) {
    throw new Error(`No departments found for org ${orgId}; cannot seed inspection workflow job roles`);
  }
  return fallback.rows[0].dept_id;
}

async function seedInspWorkflowJobRoles(client, orgId, stepDefs, stats) {
  const deptId = await resolveDefaultDeptId(client, orgId);
  for (const def of stepDefs) {
    const exists = await client.query(
      `
        SELECT 1 FROM "tblWFInspJobRole"
         WHERE wf_insp_steps_id = $1 AND org_id = $2 AND job_role_id = $3
         LIMIT 1
      `,
      [def.wfInspStepsId, orgId, MANAGER_ROLE],
    );
    if (exists.rows.length) continue;

    if (isDryRun) {
      stats.wfInspJobRoles += 1;
      continue;
    }

    const wfInspJobRoleId = await getNextId(client, 'tblWFInspJobRole', 'wf_insp_job_role_id', 'WFIJR', 3);
    await client.query(
      `
        INSERT INTO "tblWFInspJobRole"
          (wf_insp_job_role_id, wf_insp_steps_id, job_role_id, emp_int_id, dept_id, org_id)
        VALUES ($1, $2, $3, NULL, $4, $5)
      `,
      [wfInspJobRoleId, def.wfInspStepsId, MANAGER_ROLE, deptId, orgId],
    );
    stats.wfInspJobRoles += 1;
  }
}

async function ensureOrgChecklistQuestions(client, orgId, stats) {
  const existing = await client.query(
    `SELECT insp_check_id, inspection_text FROM "tblInspCheckList" WHERE org_id = $1`,
    [orgId],
  );
  const byText = new Map(
    existing.rows.map((r) => [String(r.inspection_text).trim().toLowerCase(), r.insp_check_id]),
  );

  const ids = [];
  for (const question of DEFAULT_QUESTIONS) {
    const key = question.trim().toLowerCase();
    if (byText.has(key)) {
      ids.push(byText.get(key));
      continue;
    }

    if (isDryRun) {
      stats.inspChecklist += 1;
      ids.push(`IC_DRY_${ids.length + 1}`);
      continue;
    }

    const inspCheckId = await getNextId(client, 'tblInspCheckList', 'insp_check_id', 'IC', 3);
    await client.query(
      `
        INSERT INTO "tblInspCheckList" (
          insp_check_id, inspection_text, response_type, expected_value,
          min_range, max_range, trigger_maintenance, org_id, created_by, created_on
        ) VALUES ($1, $2, 'QL', 'Yes', NULL, NULL, false, $3, $4, CURRENT_TIMESTAMP)
      `,
      [inspCheckId, question, orgId, SYSTEM_USER],
    );
    stats.inspChecklist += 1;
    ids.push(inspCheckId);
  }
  return ids;
}

async function assetTypeHasFrequency(client, orgId, assetTypeId) {
  const result = await client.query(
    `
      SELECT 1
        FROM "tblAAT_Insp_Freq" aif
        INNER JOIN "tblAATInspCheckList" aaic ON aif.aatic_id = aaic.aatic_id AND aif.org_id = aaic.org_id
       WHERE aaic.at_id = $1 AND aif.org_id = $2 AND aif.int_status = 1
       LIMIT 1
    `,
    [assetTypeId, orgId],
  );
  return result.rows.length > 0;
}

async function seedAssetTypeInspection(client, orgId, assetTypeId, inspCheckIds, stepDefs, stats) {
  if (!isDryRun) {
    await client.query(
      `UPDATE "tblAssetTypes" SET inspection_required = true WHERE asset_type_id = $1 AND org_id = $2`,
      [assetTypeId, orgId],
    );
  }
  stats.assetTypesFlagged += 1;

  if (await assetTypeHasFrequency(client, orgId, assetTypeId)) {
    stats.freqSkipped += 1;
  } else if (isDryRun) {
    stats.freqInserted += 1;
    stats.mappings += DEFAULT_QUESTIONS.length;
  } else {
    let firstAaticId = null;

    for (const inspCheckId of inspCheckIds) {
      const aaticId = await getNextId(client, 'tblAATInspCheckList', 'aatic_id', 'AATIC', 3);
      if (!firstAaticId) firstAaticId = aaticId;

      await client.query(
        `
          INSERT INTO "tblAATInspCheckList" (
            aatic_id, at_id, asset_id, insp_check_id, expected_value,
            min_range, max_range, trigger_maintenance, org_id, created_by, created_on
          ) VALUES ($1, $2, NULL, $3, 'Yes', NULL, NULL, false, $4, $5, CURRENT_TIMESTAMP)
        `,
        [aaticId, assetTypeId, inspCheckId, orgId, SYSTEM_USER],
      );
      stats.mappings += 1;
    }

    const aatifId = await getNextId(client, 'tblAAT_Insp_Freq', 'aatif_id', 'AATIF', 3);
    await client.query(
      `
        INSERT INTO "tblAAT_Insp_Freq" (
          aatif_id, aatic_id, freq, uom, text, maintained_by,
          int_status, org_id, is_recurring, emp_int_id, created_by, created_on
        ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, true, NULL, $8, CURRENT_TIMESTAMP)
      `,
      [aatifId, firstAaticId, INSP_FREQUENCY, INSP_UOM, INSP_FREQ_TEXT, MAINTAINED_BY, orgId, SYSTEM_USER],
    );
    stats.freqInserted += 1;
  }

  for (const def of stepDefs) {
    const exists = await client.query(
      `
        SELECT 1 FROM "tblWFATInspSeqs"
         WHERE at_id = $1 AND org_id = $2 AND wf_steps_id = $3
         LIMIT 1
      `,
      [assetTypeId, orgId, def.wfInspStepsId],
    );
    if (exists.rows.length) continue;

    if (isDryRun) {
      stats.wfAtInspSeqs += 1;
      continue;
    }

    const wfatisId = await getNextId(client, 'tblWFATInspSeqs', 'wfatis_id', 'WFATIS', 3);
    await client.query(
      `
        INSERT INTO "tblWFATInspSeqs" (wfatis_id, at_id, wf_steps_id, seqs_no, org_id)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [wfatisId, assetTypeId, def.wfInspStepsId, def.seq, orgId],
    );
    stats.wfAtInspSeqs += 1;
  }
}

async function seedOrg(client, orgId, orgName) {
  const stats = {
    wfInspSteps: 0,
    wfInspJobRoles: 0,
    inspChecklist: 0,
    assetTypesFlagged: 0,
    freqInserted: 0,
    freqSkipped: 0,
    mappings: 0,
    wfAtInspSeqs: 0,
  };

  console.log(`\n── ${orgId}: ${orgName} ──`);

  const stepDefs = await seedInspWorkflowSteps(client, orgId, stats);
  await seedInspWorkflowJobRoles(client, orgId, stepDefs, stats);
  const inspCheckIds = await ensureOrgChecklistQuestions(client, orgId, stats);

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
    await seedAssetTypeInspection(
      client,
      orgId,
      assetType.asset_type_id,
      inspCheckIds,
      stepDefs,
      stats,
    );
  }

  console.log(
    `  ${isDryRun ? '[dry-run] ' : ''}` +
      `${stats.assetTypesFlagged} asset types | ` +
      `checklist Q +${stats.inspChecklist} | ` +
      `freq +${stats.freqInserted} skip ${stats.freqSkipped} | ` +
      `mappings +${stats.mappings} | ` +
      `wf insp steps +${stats.wfInspSteps} | wf insp roles +${stats.wfInspJobRoles} | ` +
      `sequences +${stats.wfAtInspSeqs}`,
  );

  return stats;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const dbName = databaseNameFromUrl(connectionString);
  if (dbName !== TARGET_DATABASE) {
    throw new Error(`Refusing to run: expected database ${TARGET_DATABASE}, got ${dbName || 'unknown'}`);
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
      `${isDryRun ? '[DRY RUN] ' : ''}Seeding complete inspection setup for ${orgs.rows.length} org(s)...`,
    );

    if (!isDryRun) await client.query('BEGIN');

    const totals = {
      wfInspSteps: 0,
      wfInspJobRoles: 0,
      inspChecklist: 0,
      assetTypesFlagged: 0,
      freqInserted: 0,
      freqSkipped: 0,
      mappings: 0,
      wfAtInspSeqs: 0,
    };

    for (const org of orgs.rows) {
      const stats = await seedOrg(client, org.org_id, org.text);
      for (const key of Object.keys(totals)) totals[key] += stats[key];
    }

    if (!isDryRun) await client.query('COMMIT');

    console.log('\n════════════════════════════════════════');
    console.log('Inspection setup complete.');
    console.log(`  Asset types flagged:   ${totals.assetTypesFlagged}`);
    console.log(`  Checklist questions:   ${totals.inspChecklist}`);
    console.log(`  Frequencies inserted:  ${totals.freqInserted}`);
    console.log(`  Frequencies skipped:   ${totals.freqSkipped}`);
    console.log(`  Checklist mappings:    ${totals.mappings}`);
    console.log(`  WF insp steps:         ${totals.wfInspSteps}`);
    console.log(`  WF insp job roles:     ${totals.wfInspJobRoles}`);
    console.log(`  WF asset-type seqs:    ${totals.wfAtInspSeqs}`);
    console.log('════════════════════════════════════════\n');
  } catch (error) {
    if (!isDryRun) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
