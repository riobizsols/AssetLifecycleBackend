#!/usr/bin/env node

/**
 * Seed group_required asset types + ungrouped assets for Asset Groups testing.
 * Defaults to Distillery (BAN003); use --all-orgs for every Bannari org.
 *
 * Usage:
 *   node scripts/seed-bannari-group-assets.js
 *   node scripts/seed-bannari-group-assets.js --org-id=BAN003
 *   node scripts/seed-bannari-group-assets.js --all-orgs
 *   node scripts/seed-bannari-group-assets.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

const SYSTEM_USER = 'SYSTEM';
const ASSETS_PER_TYPE = 3;

const ORG_GROUP_TYPES = {
  BAN001: [
    { label: 'Lab Equipment Rack', brand: 'LabTech', model: 'LER-500' },
    { label: 'Campus Network Cabinet', brand: 'Rittal', model: 'TS8' },
  ],
  BAN002: [
    { label: 'Mill House Pump Skid', brand: 'KSB', model: 'Etanorm' },
    { label: 'Boiler Auxiliary Panel', brand: 'Siemens', model: 'S7-1500' },
  ],
  BAN003: [
    { label: 'Spirit Transfer Pump Skid', brand: 'Alfa Laval', model: 'SRP-200' },
    { label: 'Bottling Line Conveyor Section', brand: 'Krones', model: 'Modulfill' },
  ],
  BAN004: [
    { label: 'Export Docs Workstation Set', brand: 'HP', model: 'Z2 G9' },
    { label: 'Warehouse Dock Leveler Pair', brand: 'Rite-Hite', model: 'RH-600' },
  ],
  BAN005: [
    { label: 'Polishing Line Drive Set', brand: 'Breton', model: 'Luxmaster' },
    { label: 'Quarry Compressor Bank', brand: 'Atlas Copco', model: 'GA90' },
  ],
};

function parseArgs(argv) {
  const args = { dryRun: false, orgId: 'BAN003', allOrgs: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--all-orgs') args.allOrgs = true;
    else if (arg.startsWith('--org-id=')) args.orgId = arg.slice('--org-id='.length);
  }
  return args;
}

function nextId(prefix, maxId, seq) {
  const current = maxId && String(maxId).startsWith(prefix)
    ? parseInt(String(maxId).slice(prefix.length), 10)
    : 0;
  return `${prefix}${String(current + seq).padStart(6, '0')}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const orgIds = args.allOrgs ? Object.keys(ORG_GROUP_TYPES) : [args.orgId];

    const vendors = await client.query(`
      SELECT DISTINCT ON (org_id) vendor_id, org_id
      FROM "tblVendors" WHERE int_status = 1
      ORDER BY org_id, vendor_id
    `);
    const vendorByOrg = new Map(vendors.rows.map((r) => [r.org_id, r.vendor_id]));

    const branches = await client.query(`
      SELECT branch_id, org_id, text FROM "tblBranches"
      WHERE int_status = 1 ORDER BY org_id, branch_id
    `);
    const branchesByOrg = new Map();
    for (const b of branches.rows) {
      if (!branchesByOrg.has(b.org_id)) branchesByOrg.set(b.org_id, []);
      branchesByOrg.get(b.org_id).push(b);
    }

    const depts = await client.query(`
      SELECT dept_id, org_id, branch_id FROM "tblDepartments" WHERE int_status = 1
    `);
    const deptsByBranch = new Map();
    for (const d of depts.rows) {
      if (!deptsByBranch.has(d.branch_id)) deptsByBranch.set(d.branch_id, []);
      deptsByBranch.get(d.branch_id).push(d);
    }

    const maxIds = await client.query(`
      SELECT
        (SELECT MAX(asset_type_id) FROM "tblAssetTypes" WHERE asset_type_id LIKE 'BNT%') AS max_type,
        (SELECT MAX(asset_id) FROM "tblAssets" WHERE asset_id LIKE 'BNA%') AS max_asset,
        (SELECT MAX(dept_asset_type_id) FROM "tblDeptAssetTypes" WHERE dept_asset_type_id LIKE 'BND%') AS max_dat,
        (SELECT MAX(prod_serv_id) FROM "tblProdServs" WHERE prod_serv_id LIKE 'BNP%') AS max_prod,
        (SELECT MAX(ven_prod_serv_id) FROM "tblVendorProdService" WHERE ven_prod_serv_id LIKE 'BNL%') AS max_vps
    `);
    const caps = maxIds.rows[0];

    let typeSeq = 0;
    let assetSeq = 0;
    let datSeq = 0;
    let prodSeq = 0;
    let vpsSeq = 0;

    const summary = { typesCreated: 0, assetsCreated: 0, mapsCreated: 0 };
    const created = [];

    console.log(
      `Seeding Asset Groups test data for ${orgIds.join(', ')}` +
        (args.dryRun ? ' [DRY RUN]' : ''),
    );

    if (!args.dryRun) await client.query('BEGIN');

    for (const orgId of orgIds) {
      const specs = ORG_GROUP_TYPES[orgId];
      if (!specs) {
        console.warn(`No catalog for ${orgId}`);
        continue;
      }
      const vendorId = vendorByOrg.get(orgId);
      const orgBranches = branchesByOrg.get(orgId) || [];
      if (!vendorId || !orgBranches.length) {
        console.warn(`Skip ${orgId}: missing vendor/branches`);
        continue;
      }

      // Prefer first branch (e.g. Bhavani for BAN003) so ACM branch filters still work
      const primaryBranch = orgBranches[0];
      const branchDepts = deptsByBranch.get(primaryBranch.branch_id) || [];
      const now = new Date();

      for (const spec of specs) {
        const existing = await client.query(
          `
          SELECT at.asset_type_id,
                 COUNT(a.asset_id) FILTER (
                   WHERE a.current_status = 'Active'
                     AND NOT EXISTS (
                       SELECT 1 FROM "tblAssetGroup_D" gd WHERE gd.asset_id = a.asset_id
                     )
                 )::int AS available
          FROM "tblAssetTypes" at
          LEFT JOIN "tblAssets" a ON a.asset_type_id = at.asset_type_id
          WHERE at.org_id = $1 AND at.text = $2 AND at.group_required = true AND at.int_status = 1
          GROUP BY at.asset_type_id
          `,
          [orgId, spec.label],
        );
        if (existing.rows.some((r) => r.available >= ASSETS_PER_TYPE)) {
          console.log(`  skip existing ${orgId} ${spec.label}`);
          created.push({
            orgId,
            branchId: primaryBranch.branch_id,
            branch: primaryBranch.text,
            assetTypeId: existing.rows[0].asset_type_id,
            text: spec.label,
            available: existing.rows[0].available,
          });
          continue;
        }

        typeSeq += 1;
        prodSeq += 1;
        vpsSeq += 1;
        const assetTypeId = nextId('BNT', caps.max_type, typeSeq);
        const prodId = nextId('BNP', caps.max_prod, prodSeq);
        const vpsId = nextId('BNL', caps.max_vps, vpsSeq);
        const text = spec.label.slice(0, 50);

        if (!args.dryRun) {
          await client.query(
            `
            INSERT INTO "tblAssetTypes" (
              org_id, asset_type_id, int_status, assignment_type,
              inspection_required, group_required, created_by, created_on,
              changed_by, changed_on, text, is_child, parent_asset_type_id,
              maint_lead_type, serial_num_format, last_gen_seq_no, depreciation_type
            ) VALUES (
              $1, $2, 1, 'department',
              false, true, $3, $4,
              $3, $4, $5, false, null,
              null, 1, $6, 'ND'
            )
            `,
            [orgId, assetTypeId, SYSTEM_USER, now, text, ASSETS_PER_TYPE],
          );

          await client.query(
            `
            INSERT INTO "tblProdServs" (
              prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description
            ) VALUES ($1, $2, $3, $4, $5, 'active', 'product', $6)
            `,
            [prodId, orgId, assetTypeId, spec.brand, spec.model, `${text} for Asset Groups testing`],
          );

          await client.query(
            `
            INSERT INTO "tblVendorProdService" (ven_prod_serv_id, prod_serv_id, vendor_id, org_id)
            VALUES ($1, $2, $3, $4)
            `,
            [vpsId, prodId, vendorId, orgId],
          );

          for (const dept of branchDepts) {
            datSeq += 1;
            await client.query(
              `
              INSERT INTO "tblDeptAssetTypes" (
                dept_asset_type_id, dept_id, asset_type_id, int_status,
                created_by, created_on, changed_by, changed_on, org_id
              ) VALUES ($1, $2, $3, 1, $4, $5, $4, $5, $6)
              `,
              [nextId('BND', caps.max_dat, datSeq), dept.dept_id, assetTypeId, SYSTEM_USER, now, orgId],
            );
            summary.mapsCreated += 1;
          }
        }

        summary.typesCreated += 1;
        const assetIds = [];

        for (let a = 0; a < ASSETS_PER_TYPE; a += 1) {
          assetSeq += 1;
          const assetId = nextId('BNA', caps.max_asset, assetSeq);
          assetIds.push(assetId);
          const assetText = `${spec.brand} ${spec.model} #${a + 1}`.slice(0, 50);

          if (!args.dryRun) {
            await client.query(
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
                $9, $10, $11, 'Active',
                $12, null, null, $13,
                $11, $14, $11, $14,
                $7, $15, 10,
                $16, $14, $14, $17
              )
              `,
              [
                assetTypeId,
                assetId,
                assetText,
                `AG${String(parseInt(assetId.slice(3), 10)).padStart(8, '0')}`,
                `${spec.brand} ${spec.model}`,
                primaryBranch.branch_id,
                vendorId,
                prodId,
                String(150000 + a * 10000),
                new Date('2025-04-01T00:00:00.000Z'),
                SYSTEM_USER,
                new Date('2028-04-01T00:00:00.000Z'),
                orgId,
                now,
                new Date('2032-04-01T00:00:00.000Z'),
                `INV-AG-${assetId.slice(-6)}`,
                primaryBranch.text,
              ],
            );
          }
          summary.assetsCreated += 1;
        }

        created.push({
          orgId,
          branchId: primaryBranch.branch_id,
          branch: primaryBranch.text,
          assetTypeId,
          text,
          assets: assetIds,
          available: ASSETS_PER_TYPE,
        });
        console.log(`  + ${orgId} ${text} (${assetTypeId}) → ${ASSETS_PER_TYPE} ungrouped on ${primaryBranch.branch_id}`);
      }
    }

    if (!args.dryRun) await client.query('COMMIT');

    console.log('\nDone:', summary);
    console.log('\nUse these in Asset Groups → Create:');
    for (const row of created) {
      console.log(
        `  Type: ${row.assetTypeId} — ${row.text} (${row.available} available) | Branch: ${row.branch}`,
      );
      if (row.assets?.length) console.log(`    Assets: ${row.assets.join(', ')}`);
    }
  } catch (err) {
    if (!args.dryRun) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        /* ignore */
      }
    }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
