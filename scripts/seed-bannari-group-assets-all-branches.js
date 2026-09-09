#!/usr/bin/env node

/**
 * Ensure each group-test asset type has 3 ungrouped assets on every branch of its org.
 * Types: labels from seed-bannari-group-assets.js catalogs.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const LABELS = [
  'Lab Equipment Rack',
  'Campus Network Cabinet',
  'Mill House Pump Skid',
  'Boiler Auxiliary Panel',
  'Spirit Transfer Pump Skid',
  'Bottling Line Conveyor Section',
  'Export Docs Workstation Set',
  'Warehouse Dock Leveler Pair',
  'Polishing Line Drive Set',
  'Quarry Compressor Bank',
];

const ASSETS_PER_BRANCH = 3;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const types = await c.query(
    `
    SELECT at.asset_type_id, at.org_id, at.text, ps.prod_serv_id, ps.brand, ps.model,
           (SELECT vendor_id FROM "tblVendors" v
            WHERE v.org_id = at.org_id AND v.int_status = 1
            ORDER BY v.vendor_id LIMIT 1) AS vendor_id
    FROM "tblAssetTypes" at
    JOIN "tblProdServs" ps ON ps.asset_type_id = at.asset_type_id
    WHERE at.group_required = true
      AND at.int_status = 1
      AND at.text = ANY($1::text[])
    ORDER BY at.org_id, at.text
    `,
    [LABELS],
  );

  const branches = await c.query(`
    SELECT branch_id, org_id, text FROM "tblBranches" WHERE int_status = 1 ORDER BY org_id, branch_id
  `);
  const branchesByOrg = new Map();
  for (const b of branches.rows) {
    if (!branchesByOrg.has(b.org_id)) branchesByOrg.set(b.org_id, []);
    branchesByOrg.get(b.org_id).push(b);
  }

  const maxAsset = await c.query(`SELECT MAX(asset_id) AS m FROM "tblAssets" WHERE asset_id LIKE 'BNA%'`);
  let seq = parseInt(String(maxAsset.rows[0].m || 'BNA000000').slice(3), 10) || 0;
  const now = new Date();
  let created = 0;

  await c.query('BEGIN');

  for (const t of types.rows) {
    const orgBranches = branchesByOrg.get(t.org_id) || [];
    for (const branch of orgBranches) {
      const existing = await c.query(
        `
        SELECT COUNT(*)::int AS c FROM "tblAssets" a
        WHERE a.asset_type_id = $1 AND a.branch_id = $2 AND a.current_status = 'Active'
          AND NOT EXISTS (SELECT 1 FROM "tblAssetGroup_D" gd WHERE gd.asset_id = a.asset_id)
        `,
        [t.asset_type_id, branch.branch_id],
      );
      const need = ASSETS_PER_BRANCH - existing.rows[0].c;
      if (need <= 0) continue;

      for (let i = 0; i < need; i += 1) {
        seq += 1;
        const assetId = `BNA${String(seq).padStart(6, '0')}`;
        const n = existing.rows[0].c + i + 1;
        await c.query(
          `
          INSERT INTO "tblAssets" (
            asset_type_id, asset_id, text, serial_number, description,
            branch_id, purchase_vendor_id, prod_serv_id, maintsch_id,
            purchased_cost, purchased_on, purchased_by, current_status,
            warranty_period, parent_asset_id, group_id, org_id,
            created_by, created_on, changed_by, changed_on,
            service_vendor_id, expiry_date, useful_life_years,
            invoice_no, commissioned_date, depreciation_start_date, location
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, null,
            $9, $10, 'SYSTEM', 'Active',
            $11, null, null, $12,
            'SYSTEM', $13, 'SYSTEM', $13,
            $7, $14, 10,
            $15, $13, $13, $16
          )
          `,
          [
            t.asset_type_id,
            assetId,
            `${t.brand} ${t.model} #${n}`.slice(0, 50),
            `AG${String(seq).padStart(8, '0')}`,
            `${t.brand} ${t.model}`,
            branch.branch_id,
            t.vendor_id,
            t.prod_serv_id,
            String(150000 + n * 10000),
            new Date('2025-04-01T00:00:00.000Z'),
            new Date('2028-04-01T00:00:00.000Z'),
            t.org_id,
            now,
            new Date('2032-04-01T00:00:00.000Z'),
            `INV-AG-${assetId.slice(-6)}`,
            branch.text,
          ],
        );
        created += 1;
        console.log(`+ ${assetId} ${t.text} @ ${branch.branch_id} (${branch.text})`);
      }
    }
  }

  await c.query('COMMIT');

  const verify = await c.query(
    `
    SELECT at.org_id, at.asset_type_id, at.text, a.branch_id, COUNT(*)::int AS available
    FROM "tblAssetTypes" at
    JOIN "tblAssets" a ON a.asset_type_id = at.asset_type_id
    WHERE at.text = ANY($1::text[])
      AND a.current_status = 'Active'
      AND NOT EXISTS (SELECT 1 FROM "tblAssetGroup_D" gd WHERE gd.asset_id = a.asset_id)
    GROUP BY at.org_id, at.asset_type_id, at.text, a.branch_id
    ORDER BY at.org_id, at.text, a.branch_id
    `,
    [LABELS],
  );

  console.log(`\nCreated ${created} assets`);
  console.log('\nAvailable by org/type/branch:');
  for (const row of verify.rows) {
    console.log(`  ${row.org_id} | ${row.asset_type_id} ${row.text} | ${row.branch_id} → ${row.available}`);
  }

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
