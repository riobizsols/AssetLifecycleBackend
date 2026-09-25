/**
 * Seed Person A (1 hour) vs Person B (1 day) hold-duration examples
 * for the same product (Hydraulic Filter SPC901).
 *
 * Usage: node scripts/seedSpareHoldDurationDemo.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const ORG_ID = process.env.SEED_ORG_ID || 'ORG003';
const DB_URL =
  process.env.SEED_DATABASE_URL ||
  (process.env.DATABASE_URL || '').replace(/\/[^/]+(\?|$)/, '/ngp_db$1');

const p = new Pool({
  connectionString: DB_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 25000,
});

(async () => {
  const client = await p.connect();
  try {
    await client.query('BEGIN');

    const branch = await client.query(
      `SELECT branch_id FROM "tblBranches" WHERE org_id = $1 ORDER BY branch_id LIMIT 1`,
      [ORG_ID],
    );
    const branchId = branch.rows[0]?.branch_id || null;

    const store = await client.query(
      `SELECT ss_id FROM "tblSpareStore" WHERE org_id = $1 ORDER BY ss_id LIMIT 1`,
      [ORG_ID],
    );
    const ssId = store.rows[0]?.ss_id || 'SS001';

    const asset = await client.query(
      `SELECT asset_id FROM "tblAssets" WHERE org_id = $1 ORDER BY created_on DESC NULLS LAST LIMIT 1`,
      [ORG_ID],
    );
    const assetId = asset.rows[0]?.asset_id || null;

    const ams = await client.query(
      `SELECT ams_id, asset_id FROM "tblAssetMaintSch" WHERE org_id = $1 ORDER BY created_on DESC NULLS LAST LIMIT 1`,
      [ORG_ID],
    );
    const amsId = ams.rows[0]?.ams_id || null;
    const amsAssetId = ams.rows[0]?.asset_id || assetId;

    // Ensure category + free units exist
    await client.query(
      `
        INSERT INTO "tblSPCategory" (
          spc_id, text, uom, minimum_stock, re_order_level, int_status,
          org_id, branch_id, created_on, changed_on
        ) VALUES (
          'SPC901', 'Hydraulic Filter', 'PCS', 2, 5, 1,
          $1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (spc_id) DO UPDATE SET text = EXCLUDED.text, int_status = 1
      `,
      [ORG_ID, branchId],
    );

    const people = [
      {
        si_id: 'SI9101',
        spid_id: 'SPID9101',
        person: 'Person A',
        reservedAgoHours: 2,
        consumedAgoHours: 1, // held ~1 hour
      },
      {
        si_id: 'SI9102',
        spid_id: 'SPID9102',
        person: 'Person B',
        reservedAgoHours: 26,
        consumedAgoHours: 2, // held ~24 hours
      },
    ];

    for (const ppl of people) {
      await client.query(
        `
          INSERT INTO "tblSPIndDet" (
            spid_id, spld_id, spc_id, serial_number, is_used,
            org_id, branch_id, asset_id, created_on, changed_on
          ) VALUES (
            $1, COALESCE((SELECT spld_id FROM "tblSPLotDet" WHERE spc_id = 'SPC901' AND org_id = $2 LIMIT 1), 'SPLD901'),
            'SPC901', $3, 1, $2, $4, $5,
            CURRENT_TIMESTAMP - ($6::int * INTERVAL '1 hour'),
            CURRENT_TIMESTAMP - ($7::int * INTERVAL '1 hour')
          )
          ON CONFLICT (spid_id) DO UPDATE
          SET is_used = 1, asset_id = EXCLUDED.asset_id, spc_id = 'SPC901'
        `,
        [
          ppl.spid_id,
          ORG_ID,
          `HOLD-${ppl.person.replace(/\s+/g, '')}`,
          branchId,
          amsAssetId,
          ppl.reservedAgoHours,
          ppl.consumedAgoHours,
        ],
      );

      const remarks = JSON.stringify({ spc_id: 'SPC901', note: 'hold-duration demo' });

      await client.query(
        `
          INSERT INTO "tblSpareIssue" (
            si_id, org_id, branch_id, ss_id, spid_id, quantity_issued,
            issued_to, issued_by, remarks, status,
            assetmaintsch_id, asset_id,
            created_by, created_on, changed_by, changed_on
          ) VALUES (
            $1, $2, $3, $4, $5, 1,
            $6, 'seed', $7, 'IE',
            $8, $9,
            'seed',
            CURRENT_TIMESTAMP - ($10::int * INTERVAL '1 hour'),
            'seed',
            CURRENT_TIMESTAMP - ($11::int * INTERVAL '1 hour')
          )
          ON CONFLICT (si_id) DO UPDATE
          SET issued_to = EXCLUDED.issued_to,
              status = 'IE',
              remarks = EXCLUDED.remarks,
              spid_id = EXCLUDED.spid_id,
              created_on = EXCLUDED.created_on,
              changed_on = EXCLUDED.changed_on,
              asset_id = EXCLUDED.asset_id,
              assetmaintsch_id = EXCLUDED.assetmaintsch_id
        `,
        [
          ppl.si_id,
          ORG_ID,
          branchId,
          ssId,
          ppl.spid_id,
          ppl.person,
          remarks,
          amsId,
          amsAssetId,
          ppl.reservedAgoHours,
          ppl.consumedAgoHours,
        ],
      );

      // History: reserved (IS) then consumed (IE)
      await client.query(`DELETE FROM "tblSpareHistory" WHERE si_id = $1`, [ppl.si_id]);

      await client.query(
        `
          INSERT INTO "tblSpareHistory" (
            sph_id, si_id, status, remarks, org_id, branch_id, created_by, created_on
          ) VALUES
            ($1, $2, 'IS', $3, $4, $5, 'seed', CURRENT_TIMESTAMP - ($6::int * INTERVAL '1 hour')),
            ($7, $2, 'IE', $8, $4, $5, 'seed', CURRENT_TIMESTAMP - ($9::int * INTERVAL '1 hour'))
        `,
        [
          ppl.si_id === 'SI9101' ? 'SPH9101' : 'SPH9103',
          ppl.si_id,
          `Reserved for ${ppl.person}`,
          ORG_ID,
          branchId,
          ppl.reservedAgoHours,
          ppl.si_id === 'SI9101' ? 'SPH9102' : 'SPH9104',
          `Consumed by ${ppl.person}`,
          ppl.consumedAgoHours,
        ],
      );
    }

    await client.query('COMMIT');
    console.log('Seeded hold-duration demo: Person A (~1h) and Person B (~24h) on SPC901');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await p.end();
  }
})();
