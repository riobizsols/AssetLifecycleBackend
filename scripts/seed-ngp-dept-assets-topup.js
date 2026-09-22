/**
 * Top up each NGP department to TARGET_PER_DEPT assets (default 6),
 * using asset types that match the department.
 *
 * Usage:
 *   node scripts/seed-ngp-dept-assets-topup.js
 *   node scripts/seed-ngp-dept-assets-topup.js --dry-run
 *   node scripts/seed-ngp-dept-assets-topup.js --target=5
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORG = 'ORG003';
const USER = 'USR001';

/** dept_id → preferred asset types (already in ngp_db) relevant to that department */
const DEPT_ASSET_CATALOG = {
  DPT001: [
    // Computer Science — BR001
    { asset_type_id: 'AT027', text: 'CS Lab Programming PC' },
    { asset_type_id: 'AT028', text: 'CS Faculty Laptop' },
    { asset_type_id: 'AT007', text: 'Interactive Whiteboard' },
    { asset_type_id: 'AT008', text: 'Lab Microscope' },
    { asset_type_id: 'AT001', text: 'Laptop' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
  DPT002: [
    // Commerce — BR001
    { asset_type_id: 'AT029', text: 'Commerce Accounting Desktop' },
    { asset_type_id: 'AT030', text: 'Commerce Billing Printer' },
    { asset_type_id: 'AT001', text: 'Laptop' },
    { asset_type_id: 'AT007', text: 'Interactive Whiteboard' },
    { asset_type_id: 'AT906', text: 'Water Dispensor' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
  DPT003: [
    // Computer Science & Engineering — BR002
    { asset_type_id: 'AT031', text: 'CSE Programming Lab PC' },
    { asset_type_id: 'AT032', text: 'CSE Network Switch Kit' },
    { asset_type_id: 'AT002', text: 'Desktop Computer' },
    { asset_type_id: 'AT009', text: 'CNC Trainer Machine' },
    { asset_type_id: 'AT010', text: 'Digital Oscilloscope' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
  DPT004: [
    // Mechanical Engineering — BR002
    { asset_type_id: 'AT033', text: 'Mech CAD Workstation' },
    { asset_type_id: 'AT034', text: 'Mech Digital Vernier Caliper' },
    { asset_type_id: 'AT009', text: 'CNC Trainer Machine' },
    { asset_type_id: 'AT010', text: 'Digital Oscilloscope' },
    { asset_type_id: 'AT002', text: 'Desktop Computer' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
  DPT005: [
    // Education — BR003
    { asset_type_id: 'AT035', text: 'Education Teacher Tablet' },
    { asset_type_id: 'AT036', text: 'Education Lesson Laptop' },
    { asset_type_id: 'AT003', text: 'Projector' },
    { asset_type_id: 'AT011', text: 'Smart Classroom Board' },
    { asset_type_id: 'AT012', text: 'Physical Education Kit' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
  DPT006: [
    // Physical Education — BR003
    { asset_type_id: 'AT037', text: 'PE Sports Timing Device' },
    { asset_type_id: 'AT038', text: 'PE Fitness Tracker Kit' },
    { asset_type_id: 'AT012', text: 'Physical Education Kit' },
    { asset_type_id: 'AT003', text: 'Projector' },
    { asset_type_id: 'AT011', text: 'Smart Classroom Board' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
  DPT007: [
    // Primary Education — BR004
    { asset_type_id: 'AT039', text: 'Primary Teacher Tablet' },
    { asset_type_id: 'AT040', text: 'Primary Classroom Clicker Set' },
    { asset_type_id: 'AT013', text: 'Classroom PA System' },
    { asset_type_id: 'AT014', text: 'School Science Lab Kit' },
    { asset_type_id: 'AT001', text: 'Laptop' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
  DPT008: [
    // Secondary Education — BR004
    { asset_type_id: 'AT041', text: 'Secondary Science Lab Balance' },
    { asset_type_id: 'AT042', text: 'Secondary Faculty Laptop' },
    { asset_type_id: 'AT013', text: 'Classroom PA System' },
    { asset_type_id: 'AT014', text: 'School Science Lab Kit' },
    { asset_type_id: 'AT001', text: 'Laptop' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
  DPT009: [
    // Early Years — BR005
    { asset_type_id: 'AT043', text: 'Early Years Learning Tablet' },
    { asset_type_id: 'AT044', text: 'Early Years Sensory Tool Kit' },
    { asset_type_id: 'AT016', text: 'Early Years Play Equipment' },
    { asset_type_id: 'AT015', text: 'Student Tablet Cart' },
    { asset_type_id: 'AT003', text: 'Projector' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
  DPT010: [
    // Primary Education (Vanguard) — BR005
    { asset_type_id: 'AT045', text: 'Vanguard Primary Teacher Tablet' },
    { asset_type_id: 'AT046', text: 'Vanguard Primary Doc Camera' },
    { asset_type_id: 'AT015', text: 'Student Tablet Cart' },
    { asset_type_id: 'AT016', text: 'Early Years Play Equipment' },
    { asset_type_id: 'AT003', text: 'Projector' },
    { asset_type_id: 'AT907', text: 'CCTV' },
  ],
};

function parseArgs(argv) {
  const args = { dryRun: false, target: 6 };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--target=')) args.target = Math.max(1, parseInt(arg.slice(9), 10) || 6);
  }
  return args;
}

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

async function main() {
  const args = parseArgs(process.argv);
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false, max: 3 });
  const client = await pool.connect();

  try {
    const depts = await client.query(
      `SELECT d.dept_id, d.text AS dept_name, d.branch_id
       FROM "tblDepartments" d
       WHERE d.int_status = 1 AND (d.org_id = $1 OR d.org_id IS NULL)
       ORDER BY d.dept_id`,
      [ORG],
    );

    const countRows = await client.query(
      `SELECT COALESCE(a.dept_id, aa.dept_id) AS dept_id,
              COUNT(DISTINCT a.asset_id)::int AS asset_count
       FROM "tblAssets" a
       LEFT JOIN "tblAssetAssignments" aa
         ON aa.asset_id = a.asset_id AND COALESCE(aa.latest_assignment_flag, false) = true
       WHERE LOWER(COALESCE(a.current_status, 'active')) NOT IN ('scrapped', 'disposed', 'inactive')
         AND (a.org_id = $1 OR a.org_id IS NULL)
         AND COALESCE(a.dept_id, aa.dept_id) IS NOT NULL
       GROUP BY 1`,
      [ORG],
    );
    const byDept = Object.fromEntries(countRows.rows.map((r) => [r.dept_id, r.asset_count]));

    const template = await client.query(
      `SELECT purchase_vendor_id, service_vendor_id, prod_serv_id, purchased_cost
       FROM "tblAssets"
       WHERE org_id = $1 AND purchase_vendor_id IS NOT NULL
       ORDER BY asset_id
       LIMIT 1`,
      [ORG],
    );
    const t = template.rows[0] || {
      purchase_vendor_id: 'V001',
      service_vendor_id: 'V001',
      prod_serv_id: 'PS015',
      purchased_cost: '25000',
    };

    const typeTexts = await client.query(
      `SELECT asset_type_id, text FROM "tblAssetTypes" WHERE org_id = $1 OR org_id IS NULL`,
      [ORG],
    );
    const typeNameById = Object.fromEntries(typeTexts.rows.map((r) => [r.asset_type_id, r.text]));

    console.log(
      `${args.dryRun ? '[DRY-RUN] ' : ''}Topping up ${depts.rows.length} departments to ${args.target} assets each`,
    );

    if (!args.dryRun) await client.query('BEGIN');

    const created = [];
    const now = new Date();
    let assetSeq = 0;
    let assignSeq = 0;

    // Preload next IDs once, then increment locally inside the transaction
    let nextAstNum = parseInt(
      String(
        (
          await client.query(`
            SELECT asset_id FROM "tblAssets"
            WHERE asset_id ~ '^AST[0-9]+$'
            ORDER BY CAST(SUBSTRING(asset_id FROM 4) AS int) DESC LIMIT 1
          `)
        ).rows[0]?.asset_id || 'AST000',
      ).replace(/\D/g, ''),
      10,
    ) || 0;
    let nextAaNum = parseInt(
      String(
        (
          await client.query(`
            SELECT asset_assign_id FROM "tblAssetAssignments"
            WHERE asset_assign_id ~ '^AA[0-9]{1,6}$'
            ORDER BY CAST(SUBSTRING(asset_assign_id FROM 3) AS bigint) DESC LIMIT 1
          `)
        ).rows[0]?.asset_assign_id || 'AA000',
      ).replace(/\D/g, ''),
      10,
    ) || 0;
    let nextDatNum = parseInt(
      String(
        (
          await client.query(`
            SELECT dept_asset_type_id FROM "tblDeptAssetTypes"
            WHERE dept_asset_type_id ~ '^DAT[0-9]+$'
            ORDER BY CAST(SUBSTRING(dept_asset_type_id FROM 4) AS int) DESC LIMIT 1
          `)
        ).rows[0]?.dept_asset_type_id || 'DAT000',
      ).replace(/\D/g, ''),
      10,
    ) || 0;

    for (const dept of depts.rows) {
      const current = byDept[dept.dept_id] || 0;
      const need = Math.max(0, args.target - current);
      const catalog = DEPT_ASSET_CATALOG[dept.dept_id] || [
        { asset_type_id: 'AT001', text: 'Laptop' },
        { asset_type_id: 'AT907', text: 'CCTV' },
      ];

      console.log(
        `${dept.dept_id} ${dept.dept_name}: have ${current}, need ${need} more`,
      );
      if (need === 0) continue;

      for (let i = 0; i < need; i += 1) {
        const spec = catalog[i % catalog.length];
        const typeName = typeNameById[spec.asset_type_id] || spec.text;
        nextAstNum += 1;
        nextAaNum += 1;
        const assetId = `AST${String(nextAstNum).padStart(3, '0')}`;
        const assignId = `AA${String(nextAaNum).padStart(3, '0')}`;
        const serial = `NGP${String(nextAstNum).padStart(8, '0')}`;
        // tblAssets.text is varchar(50)
        const unitNo = i + 1;
        let label = `${typeName} #${unitNo}`;
        if (label.length > 50) label = `${typeName.slice(0, 46)} #${unitNo}`.slice(0, 50);

        if (args.dryRun) {
          created.push({
            dept_id: dept.dept_id,
            asset_id: assetId,
            asset_type_id: spec.asset_type_id,
            text: label,
          });
          continue;
        }

        // Ensure dept↔type mapping exists
        const mapped = await client.query(
          `SELECT 1 FROM "tblDeptAssetTypes"
           WHERE dept_id = $1 AND asset_type_id = $2 AND (org_id = $3 OR org_id IS NULL)
           LIMIT 1`,
          [dept.dept_id, spec.asset_type_id, ORG],
        );
        if (!mapped.rows[0]) {
          nextDatNum += 1;
          const datId = `DAT${String(nextDatNum).padStart(3, '0')}`;
          await client.query(
            `INSERT INTO "tblDeptAssetTypes" (
              dept_asset_type_id, dept_id, asset_type_id, int_status,
              created_by, created_on, changed_by, changed_on, org_id
            ) VALUES ($1, $2, $3, 1, $4, $5, $4, $5, $6)`,
            [datId, dept.dept_id, spec.asset_type_id, USER, now, ORG],
          );
        }

        await client.query(
          `INSERT INTO "tblAssets" (
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
          )`,
          [
            spec.asset_type_id,
            assetId,
            label,
            serial,
            `Seeded for ${dept.dept_name} (${dept.dept_id})`,
            dept.branch_id,
            t.purchase_vendor_id || 'V001',
            t.prod_serv_id || 'PS015',
            t.purchased_cost || '25000',
            new Date('2025-06-01T00:00:00.000Z'),
            USER,
            new Date('2028-05-31T18:30:00.000Z'),
            ORG,
            now,
            t.service_vendor_id || 'V001',
            new Date('2030-06-01T00:00:00.000Z'),
            `INV-NGP-${assetId}`,
            dept.dept_name,
            dept.dept_id,
          ],
        );

        await client.query(
          `INSERT INTO "tblAssetAssignments" (
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag, branch_id
          ) VALUES ($1, $2, $3, $4, null, 'A', CURRENT_TIMESTAMP, $5, true, $6)`,
          [assignId, dept.dept_id, assetId, ORG, USER, dept.branch_id],
        );

        created.push({
          dept_id: dept.dept_id,
          asset_id: assetId,
          asset_type_id: spec.asset_type_id,
          text: label,
        });
        assetSeq += 1;
        assignSeq += 1;
      }
    }

    if (!args.dryRun) await client.query('COMMIT');

    console.log(`\nCreated ${created.length} assets`);
    for (const row of created) {
      console.log(`  ${row.dept_id}\t${row.asset_id}\t${row.asset_type_id}\t${row.text}`);
    }

    // Final counts
    const finalCounts = await client.query(
      `SELECT COALESCE(a.dept_id, aa.dept_id) AS dept_id,
              COUNT(DISTINCT a.asset_id)::int AS asset_count
       FROM "tblAssets" a
       LEFT JOIN "tblAssetAssignments" aa
         ON aa.asset_id = a.asset_id AND COALESCE(aa.latest_assignment_flag, false) = true
       WHERE LOWER(COALESCE(a.current_status, 'active')) NOT IN ('scrapped', 'disposed', 'inactive')
         AND (a.org_id = $1 OR a.org_id IS NULL)
         AND COALESCE(a.dept_id, aa.dept_id) IS NOT NULL
       GROUP BY 1
       ORDER BY 1`,
      [ORG],
    );
    console.log('\nFinal counts:');
    for (const d of depts.rows) {
      const n = finalCounts.rows.find((r) => r.dept_id === d.dept_id)?.asset_count || 0;
      console.log(`  ${d.dept_id}\t${n}\t${d.dept_name}`);
    }
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
