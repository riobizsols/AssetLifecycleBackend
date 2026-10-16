/**
 * pressanna_db (presanna tenant) — vendor-based maintenance for asset types that already have
 * Active assets + service_vendor_id (IT / Workshop / Diagnostic / Lifting).
 *
 * Adds: monthly Vendor frequency, 2-step workflow (System Admin → Fire Safety Officer),
 * short vendor checklist. Trigger → approve → work order uses asset.service_vendor_id.
 *
 * Usage: node scripts/setup-presanna-vendor-maintenance.js
 *        node scripts/setup-presanna-vendor-maintenance.js --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const ADMIN = 'USR001';
const UOM_DAYS = 'UOM001';
const MAINT_TYPE = 'MT002';
const FREQ_DAYS = 30;

/** Existing approval steps from fire-safety setup */
const ORGS = [
  {
    org: 'ORG005',
    label: 'KIA',
    step1: 'WFS008',
    step2: 'WFS009',
    types: [
      { at: 'AT001', name: 'IT Equipment' },
      { at: 'AT004', name: 'Workshop Equipment' },
      { at: 'AT006', name: 'Diagnostic Equipment' },
      { at: 'AT008', name: 'Vehicle Lifting Equipment' },
    ],
  },
  {
    org: 'ORG006',
    label: 'Honda',
    step1: 'WFS010',
    step2: 'WFS011',
    types: [
      { at: 'AT009', name: 'IT Equipment' },
      { at: 'AT010', name: 'Workshop Equipment' },
      { at: 'AT011', name: 'Diagnostic Equipment' },
      { at: 'AT012', name: 'Vehicle Lifting Equipment' },
    ],
  },
];

const CHECKLIST = [
  'Inspect unit for damage and abnormal noise',
  'Verify operating parameters within range',
  'Clean filters / contacts as applicable',
  'Confirm vendor service report attached',
];

function dbUrl(name) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

const usedSeq = new Map();

async function nextId(c, table, column, prefix, pad, seqKey) {
  const re = `^${prefix}[0-9]+$`;
  const { rows } = await c.query(
    `SELECT MAX(CAST(SUBSTRING(${column} FROM $2::int) AS BIGINT)) AS n FROM "${table}" WHERE ${column} ~ $1`,
    [re, prefix.length + 1],
  );
  let n = Number(rows[0].n || 0);
  if (seqKey) {
    const s = await c.query(`SELECT last_number FROM "tblIDSequences" WHERE table_key=$1`, [seqKey]);
    n = Math.max(n, Number(s.rows[0]?.last_number || 0));
  }
  let k = 0;
  return () => {
    k += 1;
    if (seqKey) usedSeq.set(seqKey, Math.max(usedSeq.get(seqKey) || 0, n + k));
    return `${prefix}${String(n + k).padStart(pad, '0')}`;
  };
}

async function main() {
  const c = new Client({ connectionString: dbUrl('presanna_db'), ssl: false });
  await c.connect();
  try {
    await c.query('BEGIN');

    for (const o of ORGS) {
      const s1 = (await c.query(`SELECT 1 FROM "tblWFSteps" WHERE wf_steps_id=$1 AND org_id=$2`, [o.step1, o.org])).rowCount;
      const s2 = (await c.query(`SELECT 1 FROM "tblWFSteps" WHERE wf_steps_id=$1 AND org_id=$2`, [o.step2, o.org])).rowCount;
      if (!s1 || !s2) throw new Error(`${o.label}: workflow steps ${o.step1}/${o.step2} missing`);
    }

    const atmfId = await nextId(c, 'tblATMaintFreq', 'at_main_freq_id', 'ATMF', 3, 'atmf');
    const wfasId = await nextId(c, 'tblWFATSeqs', 'wf_at_seqs_id', 'WFAS', 3, 'wfas');
    const atmclId = await nextId(c, 'tblATMaintCheckList', 'at_main_checklist_id', 'ATMCL', 3, 'atmcl');

    for (const o of ORGS) {
      console.log(`\n--- ${o.label} (${o.org}) Vendor maintenance ---`);
      for (const t of o.types) {
        const assets = await c.query(
          `SELECT count(*)::int n,
                  count(*) FILTER (WHERE service_vendor_id IS NOT NULL AND BTRIM(service_vendor_id) <> '')::int with_vendor
             FROM "tblAssets" WHERE asset_type_id=$1 AND org_id=$2 AND current_status='Active'`,
          [t.at, o.org],
        );
        const { n, with_vendor } = assets.rows[0];
        if (!n) {
          console.log(`SKIP ${t.at} ${t.name}: no active assets`);
          continue;
        }
        if (!with_vendor) {
          console.log(`SKIP ${t.at} ${t.name}: assets have no service_vendor_id`);
          continue;
        }

        await c.query(
          `UPDATE "tblAssetTypes" SET required_maint=true, changed_by=$3, changed_on=CURRENT_DATE
            WHERE asset_type_id=$1 AND org_id=$2`,
          [t.at, o.org, ADMIN],
        );

        const existingFreq = await c.query(
          `SELECT at_main_freq_id FROM "tblATMaintFreq" WHERE asset_type_id=$1 AND org_id=$2`,
          [t.at, o.org],
        );
        let freqId;
        if (existingFreq.rowCount) {
          freqId = existingFreq.rows[0].at_main_freq_id;
          await c.query(
            `UPDATE "tblATMaintFreq"
                SET frequency=$2, uom=$3, text='Monthly', maintained_by='Vendor', maint_type_id=$4,
                    emp_int_id=NULL, is_recurring=true, int_status=1
              WHERE at_main_freq_id=$1`,
            [freqId, FREQ_DAYS, UOM_DAYS, MAINT_TYPE],
          );
          console.log(`Frequency ${freqId} updated → Vendor / ${FREQ_DAYS} days (${t.at})`);
        } else {
          freqId = atmfId();
          await c.query(
            `INSERT INTO "tblATMaintFreq" (
               at_main_freq_id, asset_type_id, frequency, uom, text, maintained_by, maint_type_id,
               int_status, org_id, is_recurring, emp_int_id
             ) VALUES ($1,$2,$3,$4,'Monthly','Vendor',$5,1,$6,true,NULL)`,
            [freqId, t.at, FREQ_DAYS, UOM_DAYS, MAINT_TYPE, o.org],
          );
          console.log(`Frequency ${freqId} created → Vendor / ${FREQ_DAYS} days (${t.at})`);
        }

        const wfExist = await c.query(`SELECT count(*)::int n FROM "tblWFATSeqs" WHERE asset_type_id=$1`, [t.at]);
        if (wfExist.rows[0].n === 0) {
          const a = wfasId();
          const b = wfasId();
          await c.query(
            `INSERT INTO "tblWFATSeqs" (wf_at_seqs_id, asset_type_id, wf_steps_id, seqs_no, org_id)
             VALUES ($1,$3,$4,'10',$6), ($2,$3,$5,'20',$6)`,
            [a, b, t.at, o.step1, o.step2, o.org],
          );
          console.log(`Workflow ${t.at}: 10 ${o.step1} → JR001, 20 ${o.step2} → JR016`);
        } else {
          console.log(`Workflow ${t.at}: already has ${wfExist.rows[0].n} step(s) — left unchanged`);
        }

        const clExist = await c.query(
          `SELECT count(*)::int n FROM "tblATMaintCheckList" WHERE asset_type_id=$1 AND at_main_freq_id=$2`,
          [t.at, freqId],
        );
        if (clExist.rows[0].n === 0) {
          for (const text of CHECKLIST) {
            await c.query(
              `INSERT INTO "tblATMaintCheckList" (
                 at_main_checklist_id, org_id, asset_type_id, text, at_main_freq_id, required_spare_part
               ) VALUES ($1,$2,$3,$4,$5,false)`,
              [atmclId(), o.org, t.at, text, freqId],
            );
          }
          console.log(`Checklist: ${CHECKLIST.length} items on ${freqId}`);
        } else {
          console.log(`Checklist ${t.at}: already has items — left unchanged`);
        }

        console.log(`  Assets ready: ${with_vendor}/${n} with service vendor (due after purchase+${FREQ_DAYS}d − 10d lead)`);
      }
    }

    // Ensure service vendors stay active for work orders
    await c.query(
      `UPDATE "tblVendors" SET service_supply=true, int_status=1, changed_by=$1, changed_on=NOW()
        WHERE vendor_id IN ('V001','V002')`,
      [ADMIN],
    );
    console.log('\nVendors V001/V002: service_supply=true, int_status=1');

    for (const [key, n] of usedSeq) {
      await c.query(
        `UPDATE "tblIDSequences" SET last_number = GREATEST(last_number, $2) WHERE table_key = $1`,
        [key, n],
      );
    }
    if (usedSeq.size) {
      console.log(`ID sequences: ${[...usedSeq].map(([k, n]) => `${k}=${n}`).join(', ')}`);
    }

    if (APPLY) {
      await c.query('COMMIT');
      console.log('\nCOMMITTED to pressanna_db');
    } else {
      await c.query('ROLLBACK');
      console.log('\nDRY RUN — rolled back (run with --apply to commit)');
    }
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.error('FAILED (rolled back):', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
