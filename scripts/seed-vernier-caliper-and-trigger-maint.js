/**
 * Create a Mech Digital Vernier Caliper asset and trigger manual maintenance.
 * Usage: node scripts/seed-vernier-caliper-and-trigger-maint.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const dbContext = require('../utils/dbContext');
const {
  createManualMaintenanceSchedule,
} = require('../models/maintenanceScheduleModel');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORG = 'ORG003';
const ASSET_TYPE_ID = 'AT034';
const BRANCH_ID = 'BR002';
const DEPT_ID = 'DPT004';
const USER = 'USR001';

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

async function nextAssetId(client) {
  const { rows } = await client.query(`
    SELECT asset_id FROM "tblAssets"
    WHERE asset_id ~ '^AST[0-9]+$'
    ORDER BY CAST(SUBSTRING(asset_id FROM 4) AS int) DESC
    LIMIT 1
  `);
  const last = rows[0]?.asset_id || 'AST000';
  const n = parseInt(String(last).replace(/\D/g, ''), 10) || 0;
  return `AST${String(n + 1).padStart(3, '0')}`;
}

async function nextAssignId(client) {
  // Ignore timestamp-style IDs (AA + 13 digits) that overflow int/bigint casts in older helpers.
  const { rows } = await client.query(`
    SELECT asset_assign_id FROM "tblAssetAssignments"
    WHERE asset_assign_id ~ '^AA[0-9]{1,6}$'
    ORDER BY CAST(SUBSTRING(asset_assign_id FROM 3) AS bigint) DESC
    LIMIT 1
  `);
  const last = rows[0]?.asset_assign_id || 'AA000';
  const n = parseInt(String(last).replace(/\D/g, ''), 10) || 0;
  return `AA${String(n + 1).padStart(3, '0')}`;
}

async function main() {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false, max: 3 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Prefer an existing Vernier asset that is NOT already in open maintenance
    const available = await client.query(
      `
      SELECT a.asset_id, a.asset_type_id, a.serial_number, a.current_status
      FROM "tblAssets" a
      WHERE a.org_id = $1
        AND a.asset_type_id = $2
        AND a.current_status = 'Active'
        AND NOT EXISTS (
          SELECT 1 FROM "tblAssetMaintSch" ams
          WHERE ams.asset_id = a.asset_id AND ams.org_id = a.org_id
            AND ams.status NOT IN ('CO', 'CA')
        )
        AND NOT EXISTS (
          SELECT 1 FROM "tblWFAssetMaintSch_H" wfh
          WHERE wfh.asset_id = a.asset_id AND wfh.org_id = a.org_id
            AND wfh.status NOT IN ('CO', 'CA')
        )
      ORDER BY a.asset_id
      LIMIT 1
      `,
      [ORG, ASSET_TYPE_ID],
    );

    let assetId;
    let createdNew = false;

    if (available.rows[0]) {
      assetId = available.rows[0].asset_id;
      console.log('Using existing free Vernier asset:', available.rows[0]);
    } else {
      assetId = await nextAssetId(client);
      const serial = `UW${String(parseInt(assetId.replace(/\D/g, ''), 10)).padStart(8, '0')}`;
      const now = new Date();

      // Clone vendor/prod from AST087 when present
      const template = await client.query(
        `SELECT purchase_vendor_id, service_vendor_id, prod_serv_id, purchased_cost
         FROM "tblAssets" WHERE asset_id = 'AST087' LIMIT 1`,
      );
      const t = template.rows[0] || {};

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
          $1, $2, $3, $4, $5,
          $6, $7, $8, null,
          $9, $10, $11, 'Active',
          $12, null, null, $13,
          $11, $14, $11, $14,
          $15, $16, 5,
          $17, $14, $14, $18, $19
        )
        `,
        [
          ASSET_TYPE_ID,
          assetId,
          'Mech Digital Vernier Caliper',
          serial,
          'Mitutoyo 500-196-30 (manual maintenance seed)',
          BRANCH_ID,
          t.purchase_vendor_id || 'V001',
          t.prod_serv_id || 'PS015',
          t.purchased_cost || '45000',
          new Date('2025-04-01T00:00:00.000Z'),
          USER,
          new Date('2028-03-31T18:30:00.000Z'),
          ORG,
          now,
          t.service_vendor_id || 'V001',
          new Date('2030-04-01T00:00:00.000Z'),
          `INV-UW-${assetId}`,
          'Mechanical Engineering',
          DEPT_ID,
        ],
      );

      // Dept assignment so ACM dept-scoped users can see it
      const aaId = await nextAssignId(client);
      await client.query(
        `
        INSERT INTO "tblAssetAssignments" (
          asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
          action, action_on, action_by, latest_assignment_flag, branch_id
        ) VALUES ($1, $2, $3, $4, null, 'A', CURRENT_TIMESTAMP, $5, true, $6)
        `,
        [aaId, DEPT_ID, assetId, ORG, USER, BRANCH_ID],
      );

      createdNew = true;
      console.log('Created asset:', { assetId, serial, branch: BRANCH_ID, dept: DEPT_ID });
    }

    // Prefer active Calibration freq for Vernier when present
    await client.query(
      `
      UPDATE "tblATMaintFreq"
      SET int_status = 1
      WHERE at_main_freq_id = 'ATMF071' AND asset_type_id = $1 AND org_id = $2
      `,
      [ASSET_TYPE_ID, ORG],
    );

    await client.query('COMMIT');

    const result = await withPool(pool, () =>
      createManualMaintenanceSchedule({
        asset_id: assetId,
        asset_type_id: ASSET_TYPE_ID,
        org_id: ORG,
        created_by: USER,
      }),
    );

    console.log('Maintenance triggered:', result);
    console.log(
      JSON.stringify(
        {
          ok: true,
          createdNew,
          asset_id: assetId,
          asset_type_id: ASSET_TYPE_ID,
          asset_type: 'Mech Digital Vernier Caliper',
          maintenance: result,
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
