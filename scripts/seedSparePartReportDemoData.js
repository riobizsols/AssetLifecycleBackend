/**
 * Seed demo spare stock + issue history for Spare Part Report (slow/non-moving, etc.).
 * Targets ngp_db / ORG003 by default.
 *
 * Usage: node scripts/seedSparePartReportDemoData.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const ORG_ID = process.env.SEED_ORG_ID || 'ORG003';
const DB_URL =
  process.env.SEED_DATABASE_URL ||
  (process.env.DATABASE_URL || '').replace(/\/[^/]+(\?|$)/, '/ngp_db$1');

const CATEGORIES = [
  { spc_id: 'SPC901', text: 'Hydraulic Filter', uom: 'PCS' },
  { spc_id: 'SPC902', text: 'Drive Belt', uom: 'PCS' },
  { spc_id: 'SPC903', text: 'Ball Bearing 6205', uom: 'PCS' },
  { spc_id: 'SPC904', text: 'Coolant Hose', uom: 'MTR' },
  { spc_id: 'SPC905', text: 'Seal Kit', uom: 'SET' },
];

const p = new Pool({
  connectionString: DB_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 25000,
});

function buildRemarks(spcId) {
  return JSON.stringify({ spc_id: spcId, note: 'demo seed' });
}

(async () => {
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    console.log(`Seeding Spare Part Report demo data into ${DB_URL.split('/').pop()} org=${ORG_ID}`);

    const branch = await client.query(
      `SELECT branch_id FROM "tblBranches" WHERE org_id = $1 ORDER BY branch_id LIMIT 1`,
      [ORG_ID],
    );
    const branchId = branch.rows[0]?.branch_id || null;

    let ssId = null;
    const store = await client.query(
      `SELECT ss_id FROM "tblSpareStore" WHERE org_id = $1 ORDER BY created_on ASC NULLS LAST LIMIT 1`,
      [ORG_ID],
    );
    if (store.rows[0]?.ss_id) {
      ssId = store.rows[0].ss_id;
    } else {
      ssId = 'SS901';
      await client.query(
        `
          INSERT INTO "tblSpareStore" (
            ss_id, store_code, store_name, contact, store_location,
            org_id, branch_id, created_by, created_on, changed_by, changed_on
          ) VALUES (
            $1, 'MAIN', 'Main Spare Store', NULL, 'Demo',
            $2, $3, 'seed', CURRENT_TIMESTAMP, 'seed', CURRENT_TIMESTAMP
          )
          ON CONFLICT (ss_id) DO NOTHING
        `,
        [ssId, ORG_ID, branchId],
      );
    }
    console.log('Using spare store', ssId);

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

    for (const cat of CATEGORIES) {
      await client.query(
        `
          INSERT INTO "tblSPCategory" (
            spc_id, text, uom, minimum_stock, re_order_level, int_status,
            org_id, branch_id, created_on, changed_on
          ) VALUES (
            $1, $2, $3, 2, 5, 1, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (spc_id) DO UPDATE
          SET text = EXCLUDED.text,
              uom = EXCLUDED.uom,
              int_status = 1,
              org_id = EXCLUDED.org_id
        `,
        [cat.spc_id, cat.text, cat.uom, ORG_ID, branchId],
      );
    }

    // One lot + N free individuals per category
    let lotSeq = 1;
    let indSeq = 1;
    let issueSeq = 1;
    const existingLots = await client.query(
      `SELECT COUNT(*)::int AS c FROM "tblSPLotDet" WHERE spld_id LIKE 'SPLD9%'`,
    );
    lotSeq = Number(existingLots.rows[0].c || 0) + 1;

    const freeByCat = {};
    for (const cat of CATEGORIES) {
      const spldId = `SPLD9${String(lotSeq).padStart(2, '0')}`;
      lotSeq += 1;

      await client.query(
        `
          INSERT INTO "tblSPLotDet" (
            spld_id, spc_id, unit_price, lot_purchase_date, invoice_no,
            quantity, remarks, org_id, branch_id, created_on, changed_on
          ) VALUES (
            $1, $2, 150.00, CURRENT_DATE - 400, $3,
            8, 'Demo lot for Spare Part Report', $4, $5,
            CURRENT_TIMESTAMP - INTERVAL '400 days', CURRENT_TIMESTAMP
          )
          ON CONFLICT (spld_id) DO NOTHING
        `,
        [spldId, cat.spc_id, `INV-DEMO-${cat.spc_id}`, ORG_ID, branchId],
      );

      freeByCat[cat.spc_id] = [];
      for (let i = 1; i <= 6; i += 1) {
        const spidId = `SPID9${String(indSeq).padStart(3, '0')}`;
        indSeq += 1;
        await client.query(
          `
            INSERT INTO "tblSPIndDet" (
              spid_id, spld_id, spc_id, serial_number, is_used,
              org_id, branch_id, created_on, changed_on
            ) VALUES (
              $1, $2, $3, $4, 0, $5, $6,
              CURRENT_TIMESTAMP - INTERVAL '400 days', CURRENT_TIMESTAMP
            )
            ON CONFLICT (spid_id) DO UPDATE
            SET is_used = 0, spc_id = EXCLUDED.spc_id, spld_id = EXCLUDED.spld_id
          `,
          [
            spidId,
            spldId,
            cat.spc_id,
            `DEMO-${cat.spc_id}-${i}`,
            ORG_ID,
            branchId,
          ],
        );
        freeByCat[cat.spc_id].push(spidId);
      }
    }

    // Issue history patterns:
    // SPC901 Fast (issued 10d ago), SPC902 Slow (120d), SPC903 Non-moving (400d),
    // SPC904 never issued, SPC905 Slow (200d) + older prior issue for equipment-wise
    const issuePlan = [
      { spc_id: 'SPC901', daysAgo: 10, qty: 1 },
      { spc_id: 'SPC901', daysAgo: 40, qty: 1 },
      { spc_id: 'SPC902', daysAgo: 120, qty: 1 },
      { spc_id: 'SPC903', daysAgo: 400, qty: 1 },
      { spc_id: 'SPC905', daysAgo: 200, qty: 1 },
      { spc_id: 'SPC905', daysAgo: 320, qty: 1 },
    ];

    for (const plan of issuePlan) {
      const spidId = freeByCat[plan.spc_id]?.pop();
      if (!spidId) continue;
      const siId = `SI9${String(issueSeq).padStart(3, '0')}`;
      issueSeq += 1;

      await client.query(
        `
          INSERT INTO "tblSpareIssue" (
            si_id, org_id, branch_id, ss_id, spid_id, quantity_issued,
            issued_to, issued_by, remarks, status,
            assetmaintsch_id, asset_id,
            created_by, created_on, changed_by, changed_on
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            'Demo Tech', 'seed', $7, 'IE',
            $8, $9,
            'seed', CURRENT_TIMESTAMP - ($10::int * INTERVAL '1 day'),
            'seed', CURRENT_TIMESTAMP - ($10::int * INTERVAL '1 day')
          )
          ON CONFLICT (si_id) DO UPDATE
          SET status = 'IE',
              remarks = EXCLUDED.remarks,
              created_on = EXCLUDED.created_on,
              quantity_issued = EXCLUDED.quantity_issued,
              spid_id = EXCLUDED.spid_id,
              asset_id = EXCLUDED.asset_id,
              assetmaintsch_id = EXCLUDED.assetmaintsch_id,
              ss_id = EXCLUDED.ss_id
        `,
        [
          siId,
          ORG_ID,
          branchId,
          ssId,
          spidId,
          plan.qty,
          buildRemarks(plan.spc_id),
          amsId,
          amsAssetId,
          plan.daysAgo,
        ],
      );

      // Mark consumed unit as used (still leave other free units on-hand)
      await client.query(
        `UPDATE "tblSPIndDet" SET is_used = 1, asset_id = $2, changed_on = CURRENT_TIMESTAMP WHERE spid_id = $1`,
        [spidId, amsAssetId],
      );
    }

    // Pending approval sample for overview card
    await client.query(
      `
        INSERT INTO "tblSpareIssue" (
          si_id, org_id, branch_id, ss_id, quantity_issued, remarks, status,
          created_by, created_on, changed_by, changed_on
        ) VALUES (
          'SI9990', $1, $2, $3, 1, $4, 'RQ',
          'seed', CURRENT_TIMESTAMP, 'seed', CURRENT_TIMESTAMP
        )
        ON CONFLICT (si_id) DO UPDATE SET status = 'RQ', remarks = EXCLUDED.remarks, ss_id = EXCLUDED.ss_id
      `,
      [ORG_ID, branchId, ssId, buildRemarks('SPC902')],
    );

    await client.query('COMMIT');

    const check = await client.query(
      `
        SELECT ind.spc_id, c.text,
               COUNT(*) FILTER (WHERE COALESCE(ind.is_used,0)=0)::int AS on_hand
        FROM "tblSPIndDet" ind
        LEFT JOIN "tblSPCategory" c ON c.spc_id = ind.spc_id AND c.org_id = ind.org_id
        WHERE ind.org_id = $1 AND ind.spc_id LIKE 'SPC90%'
        GROUP BY ind.spc_id, c.text
        ORDER BY ind.spc_id
      `,
      [ORG_ID],
    );
    console.log('On-hand demo stock:', check.rows);
    console.log(
      'IE issues:',
      (
        await client.query(
          `SELECT COUNT(*)::int AS c FROM "tblSpareIssue" WHERE org_id = $1 AND status = 'IE' AND si_id LIKE 'SI9%'`,
          [ORG_ID],
        )
      ).rows[0],
    );
    console.log('Done. Refresh Spare Part Report.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
    await p.end();
  }
})();
