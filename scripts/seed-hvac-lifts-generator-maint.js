/**
 * Seed maintenance data for NGP HVAC (AT070), Lifts (AT071), Generator (AT072)
 * and create a manual maintenance schedule for one asset of each type.
 *
 * Usage: node scripts/seed-hvac-lifts-generator-maint.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const dbContext = require('../utils/dbContext');
const { generateCustomIdForClient } = require('../utils/idGenerator');
const {
  createManualMaintenanceSchedule,
} = require('../models/maintenanceScheduleModel');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORG = 'ORG003';
const BRANCH_ID = 'BR001';
const DEPT_ID = 'DPT001';
const USER = 'USR001';
const VENDOR_ID = 'V009'; // NGP Campus Facility Services
const MAINT_TYPE = 'MT006'; // Preventive Maintenance
const UOM_MONTHS = 'UOM003';
const FREQ_MONTHS = 6;
const EMP_INT = 'EMP_INT_0001';

const TYPES = [
  {
    asset_type_id: 'AT070',
    name: 'HVAC',
    assetText: 'Campus HVAC AHU-1',
    brand: 'Carrier',
    model: 'AHU-30TR',
    checklist: [
      'Inspect filters and replace if clogged',
      'Check refrigerant / cooling performance',
      'Verify thermostat and control panel',
      'Clean coils and drain pan',
      'Record amp draw and noise levels',
    ],
  },
  {
    asset_type_id: 'AT071',
    name: 'Lifts',
    assetText: 'Main Block Passenger Lift-1',
    brand: 'Otis',
    model: 'Gen2-Comfort',
    checklist: [
      'Test emergency stop and alarm',
      'Inspect door sensors and alignment',
      'Check cabin lighting and intercom',
      'Lubricate guide rails as required',
      'Verify leveling accuracy at each floor',
    ],
  },
  {
    asset_type_id: 'AT072',
    name: 'Generator',
    assetText: 'Campus DG Set 250 kVA',
    brand: 'Cummins',
    model: 'C250D5',
    checklist: [
      'Check engine oil and coolant levels',
      'Inspect battery and charging system',
      'Test auto-start / ATS transfer',
      'Drain water from fuel filter',
      'Run loaded test and record voltage/Hz',
    ],
  },
];

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

async function withPool(pool, fn) {
  if (typeof dbContext.runWithDb === 'function') return dbContext.runWithDb(pool, fn);
  if (dbContext.als?.run) return dbContext.als.run({ db: pool, pool }, fn);
  const orig = dbContext.getDbFromContext;
  dbContext.getDbFromContext = () => pool;
  try {
    return await fn();
  } finally {
    dbContext.getDbFromContext = orig;
  }
}

/** Numeric next id from table max (avoids stale tblIDSequences). */
async function nextNumericId(client, table, column, prefix, pad = 3, maxDigits = null) {
  const start = prefix.length + 1;
  const digitPat = maxDigits ? `{1,${maxDigits}}` : '+';
  const { rows } = await client.query(
    `
    SELECT ${column}
      FROM "${table}"
     WHERE ${column} ~ $1
     ORDER BY CAST(SUBSTRING(${column} FROM ${start}) AS BIGINT) DESC
     LIMIT 1
    `,
    [`^${prefix}[0-9]${digitPat}$`],
  );
  const last = rows[0]?.[column];
  const n = last ? parseInt(String(last).replace(/\D/g, ''), 10) || 0 : 0;
  return `${prefix}${String(n + 1).padStart(pad, '0')}`;
}

async function nextIdSafe(client, tableKey, table, column, prefix, pad = 3) {
  // Prefer generator, but bump past real table max when sequence is behind.
  let id;
  try {
    id = await generateCustomIdForClient(client, tableKey, pad);
  } catch (_) {
    id = null;
  }
  const fromTable = await nextNumericId(client, table, column, prefix, pad);
  if (!id) return fromTable;
  const idNum = parseInt(String(id).replace(/\D/g, ''), 10) || 0;
  const tableNum = parseInt(String(fromTable).replace(/\D/g, ''), 10) || 0;
  return tableNum > idNum ? fromTable : id;
}

async function ensureProdServ(client, type) {
  const existing = await client.query(
    `SELECT prod_serv_id FROM "tblProdServs"
      WHERE org_id=$1 AND asset_type_id=$2 LIMIT 1`,
    [ORG, type.asset_type_id],
  );
  if (existing.rows[0]) return existing.rows[0].prod_serv_id;

  const id = await nextIdSafe(client, 'prod_serv', 'tblProdServs', 'prod_serv_id', 'PS', 3);
  await client.query(
    `
    INSERT INTO "tblProdServs"
      (prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description)
    VALUES ($1,$2,$3,$4,$5,1,'product',$6)
    `,
    [id, ORG, type.asset_type_id, type.brand, type.model, `${type.name} facility asset`],
  );
  // Keep sequence in sync with high-water mark
  await client.query(
    `UPDATE "tblIDSequences" SET last_number = GREATEST(last_number, $1)
      WHERE table_key = 'prod_serv'`,
    [parseInt(String(id).replace(/\D/g, ''), 10) || 0],
  ).catch(() => {});
  return id;
}

async function ensureFreq(client, type) {
  const existing = await client.query(
    `
    SELECT at_main_freq_id FROM "tblATMaintFreq"
     WHERE asset_type_id=$1 AND org_id=$2 AND COALESCE(int_status,1)=1
     ORDER BY at_main_freq_id LIMIT 1
    `,
    [type.asset_type_id, ORG],
  );
  if (existing.rows[0]) return existing.rows[0].at_main_freq_id;

  const id = await nextIdSafe(client, 'atmf', 'tblATMaintFreq', 'at_main_freq_id', 'ATMF', 3);
  await client.query(
    `
    INSERT INTO "tblATMaintFreq" (
      at_main_freq_id, asset_type_id, frequency, uom, text,
      maintained_by, maint_type_id, int_status, org_id, is_recurring, emp_int_id
    ) VALUES ($1,$2,$3,$4,$5,'Vendor',$6,1,$7,true,NULL)
    `,
    [
      id,
      type.asset_type_id,
      FREQ_MONTHS,
      UOM_MONTHS,
      `${type.name} — ${FREQ_MONTHS} Months Preventive`,
      MAINT_TYPE,
      ORG,
    ],
  );
  return id;
}

async function ensureChecklists(client, type, freqId) {
  const existing = await client.query(
    `SELECT COUNT(*)::int AS c FROM "tblATMaintCheckList"
      WHERE asset_type_id=$1 AND org_id=$2 AND at_main_freq_id=$3`,
    [type.asset_type_id, ORG, freqId],
  );
  if (existing.rows[0].c > 0) return existing.rows[0].c;

  let created = 0;
  for (const text of type.checklist) {
    const id = await nextIdSafe(client, 'atmcl', 'tblATMaintCheckList', 'at_main_checklist_id', 'ATMCL', 3);
    await client.query(
      `
      INSERT INTO "tblATMaintCheckList" (
        at_main_checklist_id, org_id, asset_type_id, text, at_main_freq_id, required_spare_part
      ) VALUES ($1,$2,$3,$4,$5,false)
      `,
      [id, ORG, type.asset_type_id, text, freqId],
    );
    created += 1;
  }
  return created;
}

async function ensureWorkflow(client, type) {
  const existing = await client.query(
    `SELECT COUNT(*)::int AS c FROM "tblWFATSeqs"
      WHERE asset_type_id=$1 AND org_id=$2`,
    [type.asset_type_id, ORG],
  );
  if (existing.rows[0].c > 0) return existing.rows[0].c;

  const steps = [
    { step: 'WFS-ORG003-01', seq: '10' },
    { step: 'WFS-ORG003-02', seq: '20' },
  ];
  for (const s of steps) {
    const id = await nextIdSafe(client, 'wfas', 'tblWFATSeqs', 'wf_at_seqs_id', 'WFAS', 3);
    await client.query(
      `
      INSERT INTO "tblWFATSeqs" (wf_at_seqs_id, asset_type_id, wf_steps_id, seqs_no, org_id)
      VALUES ($1,$2,$3,$4,$5)
      `,
      [id, type.asset_type_id, s.step, s.seq, ORG],
    );
  }
  return steps.length;
}

async function ensureDeptMap(client, type) {
  const exists = await client.query(
    `SELECT 1 FROM "tblDeptAssetTypes"
      WHERE org_id=$1 AND dept_id=$2 AND asset_type_id=$3 LIMIT 1`,
    [ORG, DEPT_ID, type.asset_type_id],
  );
  if (exists.rows.length) return false;

  const id = await nextIdSafe(client, 'dept_asset', 'tblDeptAssetTypes', 'dept_asset_type_id', 'DPTASS', 3);
  await client.query(
    `
    INSERT INTO "tblDeptAssetTypes" (
      dept_asset_type_id, dept_id, asset_type_id, org_id,
      created_by, created_on, changed_by, changed_on, int_status
    ) VALUES ($1,$2,$3,$4,$5,CURRENT_DATE,$5,CURRENT_DATE,1)
    `,
    [id, DEPT_ID, type.asset_type_id, ORG, USER],
  );
  return true;
}

async function ensureAsset(client, type, prodServId) {
  const available = await client.query(
    `
    SELECT a.asset_id, a.serial_number
      FROM "tblAssets" a
     WHERE a.org_id=$1 AND a.asset_type_id=$2 AND a.current_status='Active'
       AND NOT EXISTS (
         SELECT 1 FROM "tblAssetMaintSch" ams
          WHERE ams.asset_id=a.asset_id AND ams.org_id=a.org_id
            AND ams.status NOT IN ('CO','CA')
       )
       AND NOT EXISTS (
         SELECT 1 FROM "tblWFAssetMaintSch_H" wfh
          WHERE wfh.asset_id=a.asset_id AND wfh.org_id=a.org_id
            AND wfh.status NOT IN ('CO','CA')
       )
     ORDER BY a.asset_id
     LIMIT 1
    `,
    [ORG, type.asset_type_id],
  );
  if (available.rows[0]) {
    return { assetId: available.rows[0].asset_id, createdNew: false };
  }

  const assetId = await nextNumericId(client, 'tblAssets', 'asset_id', 'AST', 3);
  const serial = `FAC${String(parseInt(assetId.replace(/\D/g, ''), 10)).padStart(8, '0')}`;
  const now = new Date();

  await client.query(
    `
    INSERT INTO "tblAssets" (
      asset_type_id, asset_id, text, serial_number, description,
      branch_id, purchase_vendor_id, prod_serv_id, maintsch_id,
      purchased_cost, purchased_on, purchased_by, current_status,
      warranty_period, parent_asset_id, group_id, org_id,
      created_by, created_on, changed_by, changed_on,
      service_vendor_id, expiry_date, useful_life_years,
      invoice_no, commissioned_date, depreciation_start_date, location, dept_id
    ) VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,null,
      $9,$10,$11,'Active',
      $12,null,null,$13,
      $11,$14,$11,$14,
      $7,$15,10,
      $16,$14,$14,$17,$18
    )
    `,
    [
      type.asset_type_id,
      assetId,
      type.assetText,
      serial,
      `${type.name} facility asset for preventive maintenance`,
      BRANCH_ID,
      VENDOR_ID,
      prodServId,
      '250000',
      new Date('2025-01-15T00:00:00.000Z'),
      USER,
      new Date('2028-01-14T18:30:00.000Z'),
      ORG,
      now,
      new Date('2035-01-15T00:00:00.000Z'),
      `INV-FAC-${assetId}`,
      'Campus Facilities',
      DEPT_ID,
    ],
  );

  const aaId = await nextNumericId(client, 'tblAssetAssignments', 'asset_assign_id', 'AA', 3, 6);
  await client.query(
    `
    INSERT INTO "tblAssetAssignments" (
      asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
      action, action_on, action_by, latest_assignment_flag, branch_id
    ) VALUES ($1,$2,$3,$4,$5,'A',CURRENT_TIMESTAMP,$6,true,$7)
    `,
    [aaId, DEPT_ID, assetId, ORG, EMP_INT, USER, BRANCH_ID],
  );

  return { assetId, createdNew: true, serial };
}

async function main() {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false, max: 3 });
  const client = await pool.connect();
  const summary = [];

  try {
    await client.query('BEGIN');

    for (const type of TYPES) {
      const typeRow = await client.query(
        `SELECT asset_type_id, text, assignment_type, required_maint, int_status
           FROM "tblAssetTypes" WHERE asset_type_id=$1 AND org_id=$2`,
        [type.asset_type_id, ORG],
      );
      if (!typeRow.rows[0]) {
        throw new Error(`Asset type ${type.asset_type_id} (${type.name}) not found`);
      }

      // Keep Schedule / Required flags active (user-wise as in UI)
      await client.query(
        `
        UPDATE "tblAssetTypes"
           SET required_maint=true, inspection_required=true, int_status=1,
               assignment_type='user', changed_by=$3, changed_on=CURRENT_TIMESTAMP
         WHERE asset_type_id=$1 AND org_id=$2
        `,
        [type.asset_type_id, ORG, USER],
      );

      const prodServId = await ensureProdServ(client, type);
      const freqId = await ensureFreq(client, type);
      const checklistCount = await ensureChecklists(client, type, freqId);
      const wfCount = await ensureWorkflow(client, type);
      const deptMapped = await ensureDeptMap(client, type);
      const { assetId, createdNew, serial } = await ensureAsset(client, type, prodServId);

      summary.push({
        asset_type_id: type.asset_type_id,
        name: type.name,
        prod_serv_id: prodServId,
        at_main_freq_id: freqId,
        checklist_items: checklistCount,
        workflow_seqs: wfCount,
        dept_mapped: deptMapped,
        asset_id: assetId,
        asset_created: createdNew,
        serial: serial || null,
      });
    }

    await client.query('COMMIT');
    console.log('Seed committed:', JSON.stringify(summary, null, 2));

    const results = [];
    for (const row of summary) {
      const maint = await withPool(pool, () =>
        createManualMaintenanceSchedule({
          asset_id: row.asset_id,
          asset_type_id: row.asset_type_id,
          org_id: ORG,
          created_by: USER,
        }),
      );
      results.push({ ...row, maintenance: maint });
      console.log(`Maintenance created for ${row.name}:`, maint);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          tenant: TENANT_DB,
          org: ORG,
          results,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('FAILED:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
