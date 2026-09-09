#!/usr/bin/env node

/**
 * Remove previously seeded generic user-wise types (Staff Laptop / Barcode Scanner),
 * then seed 2 department-relevant user-wise asset types (2 assets each) per department.
 *
 * Usage:
 *   node scripts/reseed-bannari-user-asset-types.js
 *   node scripts/reseed-bannari-user-asset-types.js --dry-run
 *   node scripts/reseed-bannari-user-asset-types.js --org-id=BAN002
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

const SYSTEM_USER = 'SYSTEM';
const ASSETS_PER_TYPE = 2;

/** Department-name → 2 user-wise type specs relevant to that department */
const DEPT_USER_TYPES = {
  'Computer Science & Engineering': [
    { label: 'Programming Lab PC', brand: 'HP', model: 'EliteDesk 800' },
    { label: 'Network Switch Kit', brand: 'Cisco', model: 'Catalyst 2960' },
  ],
  'Electronics & Communication Engineering': [
    { label: 'Digital Oscilloscope', brand: 'Keysight', model: 'DSOX1204G' },
    { label: 'Handheld Multimeter', brand: 'Fluke', model: '87V' },
  ],
  'Mechanical Engineering': [
    { label: 'CAD Workstation', brand: 'Dell', model: 'Precision 3660' },
    { label: 'Digital Vernier Caliper', brand: 'Mitutoyo', model: '500-196-30' },
  ],
  'Artificial Intelligence & Data Science': [
    { label: 'GPU Training Workstation', brand: 'NVIDIA', model: 'DGX Station A2' },
    { label: 'Data Annotation Tablet', brand: 'Microsoft', model: 'Surface Pro 9' },
  ],
  'Primary Education': [
    { label: 'Teacher Tablet', brand: 'Lenovo', model: 'Tab M10' },
    { label: 'Classroom Clicker Set', brand: 'Turning', model: 'QT2' },
  ],
  'Secondary & Higher Secondary Education': [
    { label: 'Science Lab Balance', brand: 'Ohaus', model: 'Scout SKX' },
    { label: 'Faculty Laptop', brand: 'Lenovo', model: 'ThinkPad E14' },
  ],
  'Administration & Student Services': [
    { label: 'Admission Counter PC', brand: 'HP', model: 'ProDesk 400' },
    { label: 'ID Card Printer', brand: 'Zebra', model: 'ZC300' },
  ],
  'Middle & Senior School': [
    { label: 'Physics Demo Kit', brand: 'EduLab', model: 'PHY-200' },
    { label: 'Staff Tablet', brand: 'Samsung', model: 'Galaxy Tab A8' },
  ],
  'Sugar Production': [
    { label: 'Shift Supervisor Radio', brand: 'Motorola', model: 'DP4400e' },
    { label: 'Portable Brix Meter', brand: 'Atago', model: 'PAL-1' },
  ],
  'Quality Control': [
    { label: 'Portable Refractometer', brand: 'Atago', model: 'PAL-3' },
    { label: 'Sample Label Printer', brand: 'Brother', model: 'QL-820NWB' },
  ],
  'Engineering & Maintenance': [
    { label: 'Thermal Imaging Camera', brand: 'FLIR', model: 'E54' },
    { label: 'Digital Torque Wrench', brand: 'Snap-on', model: 'ATECH3F250' },
  ],
  'Alcohol / ENA Production': [
    { label: 'Portable Alcoholmeter', brand: 'Anton Paar', model: 'DMA 35' },
    { label: 'Process Operator Tablet', brand: 'Panasonic', model: 'Toughbook G2' },
  ],
  'Quality Control Laboratory': [
    { label: 'Micropipette Set', brand: 'Eppendorf', model: 'Research plus' },
    { label: 'Lab Sample Tablet', brand: 'Samsung', model: 'Galaxy Tab Active4' },
  ],
  'Utilities, EHS & Maintenance': [
    { label: 'Multi-Gas Detector', brand: 'Honeywell', model: 'BW Ultra' },
    { label: 'EHS Inspection Tablet', brand: 'Panasonic', model: 'Toughbook 33' },
  ],
  'Incineration Power & Maintenance': [
    { label: 'Infrared Thermometer', brand: 'Fluke', model: '568' },
    { label: 'Boiler Walkie Talkie', brand: 'Hytera', model: 'PD505' },
  ],
  'Ethanol Production': [
    { label: 'Field Refractometer', brand: 'Atago', model: 'MASTER-53a' },
    { label: 'Fermentation Log Tablet', brand: 'Getac', model: 'ZX70' },
  ],
  'Export Sales & Customer Service': [
    { label: 'Sales Laptop', brand: 'Dell', model: 'Latitude 5540' },
    { label: 'Portable Document Printer', brand: 'Brother', model: 'PJ-883' },
  ],
  'Documentation & Customs Compliance': [
    { label: 'Customs Document Scanner', brand: 'Fujitsu', model: 'ScanSnap iX1600' },
    { label: 'Compliance Tablet', brand: 'Lenovo', model: 'Tab P11' },
  ],
  'Finance & Administration': [
    { label: 'Accounts Desktop', brand: 'HP', model: 'ProOne 440' },
    { label: 'Cheque Printer', brand: 'Epson', model: 'LQ-590II' },
  ],
  'Commodity Sourcing': [
    { label: 'Sourcing Field Tablet', brand: 'Samsung', model: 'Galaxy Tab Active3' },
    { label: 'Sample Photo Camera', brand: 'Canon', model: 'EOS R50' },
  ],
  'Supplier Quality & Coordination': [
    { label: 'Supplier Audit Tablet', brand: 'Microsoft', model: 'Surface Go 3' },
    { label: 'Incoming QC Camera', brand: 'GoPro', model: 'Hero12' },
  ],
  'Freight & Shipment Coordination': [
    { label: 'Shipment Handheld Scanner', brand: 'Honeywell', model: 'CT60' },
    { label: 'Logistics Coordinator Tablet', brand: 'Zebra', model: 'ET40' },
  ],
  'Warehouse & Inventory Coordination': [
    { label: 'Warehouse Inventory Scanner', brand: 'Zebra', model: 'MC3300' },
    { label: 'Store Keeper Tablet', brand: 'Honeywell', model: 'ScanPal EDA52' },
  ],
  'Trade Compliance': [
    { label: 'Trade Docs Tablet', brand: 'Apple', model: 'iPad 10th' },
    { label: 'HS Code Reference Scanner', brand: 'Socket', model: 'S740' },
  ],
  'Slab & Tile Production': [
    { label: 'Slab Thickness Gauge', brand: 'Mitutoyo', model: '547-401' },
    { label: 'Line Operator Tablet', brand: 'Getac', model: 'ZX10' },
  ],
  'Quality Control & Finishing': [
    { label: 'Surface Gloss Meter', brand: 'BYK', model: 'micro-gloss' },
    { label: 'Finishing QC Tablet', brand: 'Samsung', model: 'Galaxy Tab Active4' },
  ],
  'Quarry Production': [
    { label: 'Quarry GPS Handheld', brand: 'Trimble', model: 'TDC600' },
    { label: 'Blast Site Radio', brand: 'Motorola', model: 'R2' },
  ],
  'Equipment Maintenance': [
    { label: 'Oil Condition Analyzer', brand: 'Fluke', model: '1537' },
    { label: 'Maintenance Tool Tablet', brand: 'Panasonic', model: 'Toughbook G2' },
  ],
  'Safety & Environmental Compliance': [
    { label: 'Noise Level Meter', brand: 'Extech', model: 'SL400' },
    { label: 'EHS Audit Tablet', brand: 'Zebra', model: 'ET45' },
  ],
  'Export Sales & Documentation': [
    { label: 'Export Sales Tablet', brand: 'Apple', model: 'iPad Air' },
    { label: 'Shipping Doc Scanner', brand: 'Epson', model: 'DS-870' },
  ],
  'Packing, Warehouse & Dispatch': [
    { label: 'Dispatch Barcode Scanner', brand: 'Zebra', model: 'DS3678' },
    { label: 'Packing Station Tablet', brand: 'Honeywell', model: 'ScanPal EDA61K' },
  ],
  'Customer Quality Coordination': [
    { label: 'Customer Sample Camera', brand: 'Sony', model: 'ZV-E10' },
    { label: 'CQ Coordinator Tablet', brand: 'Microsoft', model: 'Surface Pro 9' },
  ],
};

const FALLBACK_TYPES = [
  { label: 'Department Staff Device', brand: 'Dell', model: 'Latitude 5440' },
  { label: 'Department Handheld Tool', brand: 'Zebra', model: 'TC52' },
];

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

function specsForDept(deptText) {
  return DEPT_USER_TYPES[deptText] || FALLBACK_TYPES;
}

async function removePreviousUserSeed(client, { dryRun, orgId }) {
  const orgClause = orgId ? 'AND at.org_id = $1' : '';
  const params = orgId ? [orgId] : [];

  // Only remove user-wise types we seeded (Staff Laptop / Barcode Scanner naming)
  const types = await client.query(
    `
    SELECT at.asset_type_id, at.org_id, at.text
    FROM "tblAssetTypes" at
    WHERE at.assignment_type = 'user'
      AND at.int_status = 1
      AND (
        at.text LIKE 'Staff Laptop (%'
        OR at.text LIKE 'Barcode Scanner (%'
      )
      ${orgClause}
    ORDER BY at.asset_type_id
    `,
    params,
  );

  console.log(`Found ${types.rows.length} generic user types to remove`);
  if (!types.rows.length) return;

  const typeIds = types.rows.map((r) => r.asset_type_id);

  const assets = await client.query(
    `SELECT asset_id FROM "tblAssets" WHERE asset_type_id = ANY($1::text[])`,
    [typeIds],
  );
  const assetIds = assets.rows.map((r) => r.asset_id);

  const products = await client.query(
    `SELECT prod_serv_id FROM "tblProdServs" WHERE asset_type_id = ANY($1::text[])`,
    [typeIds],
  );
  const prodIds = products.rows.map((r) => r.prod_serv_id);

  if (dryRun) {
    console.log(`[dry-run] would delete assets=${assetIds.length}, products=${prodIds.length}, types=${typeIds.length}`);
    return;
  }

  if (assetIds.length) {
    await client.query(
      `DELETE FROM "tblAssetAssignments" WHERE asset_id = ANY($1::text[])`,
      [assetIds],
    );
    await client.query(
      `DELETE FROM "tblAssetGroup_D" WHERE asset_id = ANY($1::text[])`,
      [assetIds],
    ).catch(() => {});
    await client.query(`DELETE FROM "tblAssets" WHERE asset_id = ANY($1::text[])`, [assetIds]);
  }

  await client.query(
    `DELETE FROM "tblDeptAssetTypes" WHERE asset_type_id = ANY($1::text[])`,
    [typeIds],
  );

  if (prodIds.length) {
    await client.query(
      `DELETE FROM "tblVendorProdService" WHERE prod_serv_id = ANY($1::text[])`,
      [prodIds],
    );
    await client.query(`DELETE FROM "tblProdServs" WHERE prod_serv_id = ANY($1::text[])`, [prodIds]);
  }

  await client.query(`DELETE FROM "tblAssetTypes" WHERE asset_type_id = ANY($1::text[])`, [typeIds]);
  console.log(`Removed ${typeIds.length} types, ${assetIds.length} assets, ${prodIds.length} products`);
}

async function seedRelevantUserTypes(client, { dryRun, orgId }) {
  const orgClause = orgId ? 'AND d.org_id = $1' : '';
  const orgParams = orgId ? [orgId] : [];

  const depts = await client.query(
    `
    SELECT d.dept_id, d.text, d.org_id, d.branch_id
    FROM "tblDepartments" d
    WHERE d.int_status = 1
      ${orgClause}
    ORDER BY d.org_id, d.dept_id
    `,
    orgParams,
  );

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
    depts: depts.rows.length,
    typesCreated: 0,
    mapsCreated: 0,
    assetsCreated: 0,
    skippedDepts: 0,
  };

  for (const dept of depts.rows) {
    const vendorId = vendorByOrg.get(dept.org_id);
    if (!vendorId) {
      console.warn(`Skip ${dept.dept_id}: no vendor for org ${dept.org_id}`);
      summary.skippedDepts += 1;
      continue;
    }

    const existing = await client.query(
      `
      SELECT COUNT(*)::int AS c
      FROM "tblDeptAssetTypes" da
      JOIN "tblAssetTypes" at ON at.asset_type_id = da.asset_type_id
      WHERE da.dept_id = $1
        AND da.int_status = 1
        AND at.int_status = 1
        AND at.assignment_type = 'user'
      `,
      [dept.dept_id],
    );
    if (existing.rows[0].c > 0) {
      summary.skippedDepts += 1;
      continue;
    }

    const specs = specsForDept(dept.text);
    const now = new Date();

    for (const spec of specs) {
      typeSeq += 1;
      prodSeq += 1;
      vpsSeq += 1;
      datSeq += 1;

      const assetTypeId = nextId('BNT', caps.max_type, typeSeq);
      const prodId = nextId('BNP', caps.max_prod, prodSeq);
      const vpsId = nextId('BNL', caps.max_vps, vpsSeq);
      const datId = nextId('BND', caps.max_dat, datSeq);
      const text = spec.label.slice(0, 50);

      if (!dryRun) {
        await client.query(
          `
          INSERT INTO "tblAssetTypes" (
            org_id, asset_type_id, int_status, assignment_type,
            inspection_required, group_required, created_by, created_on,
            changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_lead_type, serial_num_format, last_gen_seq_no, depreciation_type
          ) VALUES (
            $1, $2, 1, 'user',
            false, false, $3, $4,
            $3, $4, $5, false, null,
            null, 1, $6, 'ND'
          )
          `,
          [dept.org_id, assetTypeId, SYSTEM_USER, now, text, ASSETS_PER_TYPE],
        );

        await client.query(
          `
          INSERT INTO "tblProdServs" (
            prod_serv_id, org_id, asset_type_id, brand, model, status, ps_type, description
          ) VALUES ($1, $2, $3, $4, $5, 'active', 'product', $6)
          `,
          [
            prodId,
            dept.org_id,
            assetTypeId,
            spec.brand,
            spec.model,
            `${text} for ${dept.text}`,
          ],
        );

        await client.query(
          `
          INSERT INTO "tblVendorProdService" (
            ven_prod_serv_id, prod_serv_id, vendor_id, org_id
          ) VALUES ($1, $2, $3, $4)
          `,
          [vpsId, prodId, vendorId, dept.org_id],
        );

        await client.query(
          `
          INSERT INTO "tblDeptAssetTypes" (
            dept_asset_type_id, dept_id, asset_type_id, int_status,
            created_by, created_on, changed_by, changed_on, org_id
          ) VALUES ($1, $2, $3, 1, $4, $5, $4, $5, $6)
          `,
          [datId, dept.dept_id, assetTypeId, SYSTEM_USER, now, dept.org_id],
        );
      }

      summary.typesCreated += 1;
      summary.mapsCreated += 1;

      for (let a = 0; a < ASSETS_PER_TYPE; a += 1) {
        assetSeq += 1;
        const assetId = nextId('BNA', caps.max_asset, assetSeq);
        const serial = `UW${String(parseInt(assetId.slice(3), 10)).padStart(8, '0')}`;
        const assetText = `${spec.brand} ${spec.model} #${a + 1}`.slice(0, 50);

        if (!dryRun) {
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
              $7, $15, 5,
              $16, $14, $14, $17
            )
            `,
            [
              assetTypeId,
              assetId,
              assetText,
              serial,
              `${spec.brand} ${spec.model}`,
              dept.branch_id,
              vendorId,
              prodId,
              String(25000 + a * 1500),
              new Date('2025-06-01T00:00:00.000Z'),
              SYSTEM_USER,
              new Date('2028-06-01T00:00:00.000Z'),
              dept.org_id,
              now,
              new Date('2030-06-01T00:00:00.000Z'),
              `INV-UW-${assetId.slice(-6)}`,
              dept.text,
            ],
          );
        }
        summary.assetsCreated += 1;
      }

      console.log(`  ${dept.dept_id} ${dept.text} → ${text} (${assetTypeId})`);
    }
  }

  return summary;
}

async function main() {
  const args = parseArgs(process.argv);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    if (!args.dryRun) await client.query('BEGIN');

    await removePreviousUserSeed(client, args);
    const summary = await seedRelevantUserTypes(client, args);

    if (!args.dryRun) await client.query('COMMIT');

    console.log('\nDone:', summary);

    const verify = await client.query(`
      SELECT at.asset_type_id, at.text, at.assignment_type,
             (SELECT COUNT(*)::int FROM "tblAssets" a
              WHERE a.asset_type_id = at.asset_type_id
                AND a.current_status = 'Active'
                AND a.asset_id NOT IN (
                  SELECT aa.asset_id FROM "tblAssetAssignments" aa
                  WHERE aa.action = 'A' AND aa.latest_assignment_flag = true
                )
             ) AS available_assets
      FROM "tblDeptAssetTypes" da
      JOIN "tblAssetTypes" at ON at.asset_type_id = da.asset_type_id
      WHERE da.dept_id = 'BND0019'
        AND da.int_status = 1
        AND at.assignment_type = 'user'
      ORDER BY at.text
    `);
    console.log('\nBND0019 (Engineering & Maintenance) user types:', verify.rows);
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
