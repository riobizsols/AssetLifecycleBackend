#!/usr/bin/env node

/**
 * Seed 2 department-wise (assignment_type = 'department') asset types per branch,
 * each with 2 unassigned Active assets, mapped to all departments at that branch.
 * Used to test Department Assignment across every Bannari branch.
 *
 * Usage:
 *   node scripts/seed-bannari-dept-assignment-assets.js
 *   node scripts/seed-bannari-dept-assignment-assets.js --dry-run
 *   node scripts/seed-bannari-dept-assignment-assets.js --org-id=BAN002
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

const SYSTEM_USER = 'SYSTEM';
const ASSETS_PER_TYPE = 2;

/** branch_id → 2 department-wise type specs relevant to that branch */
const BRANCH_DEPT_TYPES = {
  BNB001: [
    { label: 'Smart Classroom Projector', brand: 'Epson', model: 'EB-L200SW' },
    { label: 'Campus WiFi Access Point', brand: 'Cisco', model: 'C9120AXI' },
  ],
  BNB002: [
    { label: 'Interactive Whiteboard', brand: 'Promethean', model: 'ActivPanel 9' },
    { label: 'School Bus GPS Unit', brand: 'Fleetronics', model: 'FT-GPS-200' },
  ],
  BNB003: [
    { label: 'Library RFID Gate', brand: 'Bibliotheca', model: 'smartgate 400' },
    { label: 'Playground PA Amplifier', brand: 'Bosch', model: 'Plena 240W' },
  ],
  BNB004: [
    { label: 'Cane Weighbridge Indicator', brand: 'Mettler Toledo', model: 'IND780' },
    { label: 'Juice Flow Transmitter', brand: 'Endress+Hauser', model: 'Promag 50' },
  ],
  BNB005: [
    { label: 'Pan Vacuum Gauge Panel', brand: 'Wika', model: 'A-10' },
    { label: 'Bagasse Conveyor Sensor', brand: 'Sick', model: 'WTB4S' },
  ],
  BNB006: [
    { label: 'Crystallizer Stirrer Drive', brand: 'ABB', model: 'ACS580' },
    { label: 'Sugar Bag Sewing Machine', brand: 'Newlong', model: 'DS-9C' },
  ],
  BNB007: [
    { label: 'Column Temp Sensor Skid', brand: 'Yokogawa', model: 'YTA610' },
    { label: 'Spirit Tank Level Gauge', brand: 'Vega', model: 'VEGAPULS 64' },
  ],
  BNB008: [
    { label: 'Incinerator Draft Fan VFD', brand: 'Danfoss', model: 'FC-302' },
    { label: 'Spent Wash Transfer Pump', brand: 'KSB', model: 'MegaCPK' },
  ],
  BNB009: [
    { label: 'Fermenter Agitator Drive', brand: 'SEW', model: 'Movidrive B' },
    { label: 'Ethanol Dispatch Flow Meter', brand: 'Emerson', model: 'Micro Motion' },
  ],
  BNB010: [
    { label: 'Conference Room AV System', brand: 'Logitech', model: 'Rally Bar' },
    { label: 'Office Document Shredder', brand: 'Fellowes', model: '99Ci' },
  ],
  BNB011: [
    { label: 'Visitor Management Kiosk', brand: 'HID', model: 'EasyLobby SVM' },
    { label: 'Office UPS Bank', brand: 'APC', model: 'Smart-UPS 3000' },
  ],
  BNB012: [
    { label: 'Container Seal Verifier', brand: 'Unisto', model: 'SecureTite' },
    { label: 'Export Packing Floor Scale', brand: 'Avery Weigh-Tronix', model: 'ZM301' },
  ],
  BNB013: [
    { label: 'Bridge Saw Controller', brand: 'Breton', model: 'Smart-Cut Cont' },
    { label: 'Slab Polishing Head Unit', brand: 'Gaspari', model: 'Planet 2000' },
  ],
  BNB014: [
    { label: 'Quarry Telematics Gateway', brand: 'Trimble', model: 'LOADRITE' },
    { label: 'Rock Drill Air Compressor', brand: 'Atlas Copco', model: 'XATS 400' },
  ],
  BNB015: [
    { label: 'Container Crane Load Cell', brand: 'Straightpoint', model: 'Radiolink plus' },
    { label: 'Export Packing Strapper', brand: 'Signode', model: 'BXT3' },
  ],
};

function parseArgs(argv) {
  const args = { dryRun: false, orgId: null };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
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
    const orgClause = args.orgId ? 'AND b.org_id = $1' : '';
    const orgParams = args.orgId ? [args.orgId] : [];

    const branches = await client.query(
      `
      SELECT b.branch_id, b.text, b.org_id
      FROM "tblBranches" b
      WHERE b.int_status = 1
        ${orgClause}
      ORDER BY b.org_id, b.branch_id
      `,
      orgParams,
    );

    const depts = await client.query(`
      SELECT d.dept_id, d.text, d.org_id, d.branch_id
      FROM "tblDepartments" d
      WHERE d.int_status = 1
      ORDER BY d.branch_id, d.dept_id
    `);
    const deptsByBranch = new Map();
    for (const d of depts.rows) {
      if (!deptsByBranch.has(d.branch_id)) deptsByBranch.set(d.branch_id, []);
      deptsByBranch.get(d.branch_id).push(d);
    }

    const vendors = await client.query(`
      SELECT DISTINCT ON (org_id) vendor_id, org_id
      FROM "tblVendors"
      WHERE int_status = 1
      ORDER BY org_id, vendor_id
    `);
    const vendorByOrg = new Map(vendors.rows.map((r) => [r.org_id, r.vendor_id]));

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

    const summary = {
      branches: branches.rows.length,
      typesCreated: 0,
      mapsCreated: 0,
      assetsCreated: 0,
      skippedBranches: 0,
    };

    console.log(
      `Seeding department-assignment assets for ${branches.rows.length} branches` +
        (args.orgId ? ` (org ${args.orgId})` : '') +
        (args.dryRun ? ' [DRY RUN]' : ''),
    );

    if (!args.dryRun) await client.query('BEGIN');

    for (const branch of branches.rows) {
      const specs = BRANCH_DEPT_TYPES[branch.branch_id];
      if (!specs?.length) {
        console.warn(`Skip ${branch.branch_id}: no type catalog`);
        summary.skippedBranches += 1;
        continue;
      }

      const vendorId = vendorByOrg.get(branch.org_id);
      if (!vendorId) {
        console.warn(`Skip ${branch.branch_id}: no vendor for org ${branch.org_id}`);
        summary.skippedBranches += 1;
        continue;
      }

      const branchDepts = deptsByBranch.get(branch.branch_id) || [];
      if (!branchDepts.length) {
        console.warn(`Skip ${branch.branch_id}: no departments`);
        summary.skippedBranches += 1;
        continue;
      }

      // Idempotent: skip if both planned type labels already exist for this org with assets on this branch
      const existing = await client.query(
        `
        SELECT at.text, COUNT(a.asset_id)::int AS asset_count
        FROM "tblAssetTypes" at
        LEFT JOIN "tblAssets" a
          ON a.asset_type_id = at.asset_type_id
         AND a.branch_id = $2
         AND a.current_status = 'Active'
        WHERE at.org_id = $1
          AND at.assignment_type = 'department'
          AND at.int_status = 1
          AND at.text = ANY($3::text[])
        GROUP BY at.text
        `,
        [branch.org_id, branch.branch_id, specs.map((s) => s.label)],
      );
      const ready = new Set(
        existing.rows.filter((r) => r.asset_count >= ASSETS_PER_TYPE).map((r) => r.text),
      );
      if (ready.size >= specs.length) {
        console.log(`  ${branch.branch_id} ${branch.text}: already seeded, skip`);
        summary.skippedBranches += 1;
        continue;
      }

      const now = new Date();
      console.log(`\n${branch.branch_id} — ${branch.text}`);

      for (const spec of specs) {
        if (ready.has(spec.label)) {
          console.log(`  skip existing ${spec.label}`);
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
              false, false, $3, $4,
              $3, $4, $5, false, null,
              null, 1, $6, 'ND'
            )
            `,
            [branch.org_id, assetTypeId, SYSTEM_USER, now, text, ASSETS_PER_TYPE],
          );

          await client.query(
            `
            INSERT INTO "tblProdServs" (
              prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description
            ) VALUES ($1, $2, $3, $4, $5, 'active', 'product', $6)
            `,
            [
              prodId,
              branch.org_id,
              assetTypeId,
              spec.brand,
              spec.model,
              `${text} for ${branch.text}`,
            ],
          );

          await client.query(
            `
            INSERT INTO "tblVendorProdService" (
              ven_prod_serv_id, prod_serv_id, vendor_id, org_id
            ) VALUES ($1, $2, $3, $4)
            `,
            [vpsId, prodId, vendorId, branch.org_id],
          );

          for (const dept of branchDepts) {
            datSeq += 1;
            const datId = nextId('BND', caps.max_dat, datSeq);
            await client.query(
              `
              INSERT INTO "tblDeptAssetTypes" (
                dept_asset_type_id, dept_id, asset_type_id, int_status,
                created_by, created_on, changed_by, changed_on, org_id
              ) VALUES ($1, $2, $3, 1, $4, $5, $4, $5, $6)
              `,
              [datId, dept.dept_id, assetTypeId, SYSTEM_USER, now, branch.org_id],
            );
            summary.mapsCreated += 1;
          }
        } else {
          summary.mapsCreated += branchDepts.length;
        }

        summary.typesCreated += 1;

        for (let a = 0; a < ASSETS_PER_TYPE; a += 1) {
          assetSeq += 1;
          const assetId = nextId('BNA', caps.max_asset, assetSeq);
          const serial = `DA${String(parseInt(assetId.slice(3), 10)).padStart(8, '0')}`;
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
                serial,
                `${spec.brand} ${spec.model}`,
                branch.branch_id,
                vendorId,
                prodId,
                String(75000 + a * 5000),
                new Date('2025-03-01T00:00:00.000Z'),
                SYSTEM_USER,
                new Date('2028-03-01T00:00:00.000Z'),
                branch.org_id,
                now,
                new Date('2032-03-01T00:00:00.000Z'),
                `INV-DA-${assetId.slice(-6)}`,
                branch.text,
              ],
            );
          }
          summary.assetsCreated += 1;
        }

        console.log(
          `  + ${text} (${assetTypeId}) → ${ASSETS_PER_TYPE} unassigned assets, mapped to ${branchDepts.length} depts`,
        );
      }
    }

    if (!args.dryRun) await client.query('COMMIT');

    console.log('\nDone:', summary);

    const verify = await client.query(`
      SELECT b.branch_id, b.text AS branch,
             at.asset_type_id, at.text AS asset_type,
             COUNT(a.asset_id)::int AS assets,
             COUNT(a.asset_id) FILTER (
               WHERE NOT EXISTS (
                 SELECT 1 FROM "tblAssetAssignments" aa
                 WHERE aa.asset_id = a.asset_id
                   AND aa.action = 'A'
                   AND aa.latest_assignment_flag = true
               )
             )::int AS unassigned
      FROM "tblBranches" b
      JOIN "tblAssets" a ON a.branch_id = b.branch_id
      JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      WHERE at.assignment_type = 'department'
        AND at.text = ANY($1::text[])
      GROUP BY b.branch_id, b.text, at.asset_type_id, at.text
      ORDER BY b.branch_id, at.text
    `, [Object.values(BRANCH_DEPT_TYPES).flat().map((s) => s.label)]);

    console.log('\nVerification (unassigned dept types):');
    for (const row of verify.rows) {
      console.log(
        `  ${row.branch_id} | ${row.asset_type} | assets=${row.assets} unassigned=${row.unassigned}`,
      );
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
