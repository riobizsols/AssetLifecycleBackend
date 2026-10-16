/**
 * presanna_db: create KIA (ORG005, AT003) Fire Safety assets mirroring Honda's (ORG006, AT013),
 * plus their department assignments and the AT003 department ↔ asset-type mappings.
 *
 * Usage: node scripts/copy-presanna-fire-assets-to-kia.js           (dry run)
 *        node scripts/copy-presanna-fire-assets-to-kia.js --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const SRC = { org: 'ORG006', at: 'AT013' };
const DST = { org: 'ORG005', at: 'AT003', vendor: 'V001', prodServ: 'PS002' };
const ADMIN_USER = 'USR001';
const BRANCH = { BR004: 'BR001', BR005: 'BR002', BR006: 'BR003' };
const DEPT = {
  DPT010: 'DPT001', DPT011: 'DPT002', DPT012: 'DPT003', DPT013: 'DPT004',
  DPT014: 'DPT005', DPT016: 'DPT007', DPT017: 'DPT008',
};

function dbUrl(name) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

const map = (m, v, what) => {
  if (v == null) return v;
  if (!m[v]) throw new Error(`No KIA mapping for ${what} ${v}`);
  return m[v];
};

async function main() {
  const c = new Client({ connectionString: dbUrl('presanna_db'), ssl: false });
  await c.connect();
  try {
    await c.query('BEGIN');

    const existing = await c.query(`SELECT count(*)::int n FROM "tblAssets" WHERE asset_type_id=$1`, [DST.at]);
    if (existing.rows[0].n) throw new Error(`${DST.at} already has ${existing.rows[0].n} assets — aborting`);

    // Department ↔ asset type mappings
    const deptMaps = (await c.query(`SELECT * FROM "tblDeptAssetTypes" WHERE asset_type_id=$1 ORDER BY dept_asset_type_id`, [SRC.at])).rows;
    const seqDa = Number((await c.query(`SELECT last_number FROM "tblIDSequences" WHERE table_key='dept_asset'`)).rows[0]?.last_number || 0);
    const maxDa = Number((await c.query(`SELECT COALESCE(MAX(SUBSTRING(dept_asset_type_id FROM 7)::int),0) n FROM "tblDeptAssetTypes" WHERE dept_asset_type_id ~ '^DPTASS[0-9]+$'`)).rows[0].n);
    let da = Math.max(seqDa, maxDa);
    for (const d of deptMaps) {
      da += 1;
      await c.query(
        `INSERT INTO "tblDeptAssetTypes" (dept_asset_type_id, dept_id, asset_type_id, int_status, created_by, created_on, changed_by, changed_on, org_id, branch_id)
         VALUES ($1,$2,$3,1,$4,NOW(),$4,NOW(),$5,$6)`,
        [`DPTASS${String(da).padStart(3, '0')}`, map(DEPT, d.dept_id, 'dept'), DST.at, ADMIN_USER, DST.org, map(BRANCH, d.branch_id, 'branch')],
      );
    }
    await c.query(`UPDATE "tblIDSequences" SET last_number=GREATEST(last_number,$1) WHERE table_key='dept_asset'`, [da]);
    console.log(`Department mappings: ${deptMaps.length} KIA departments → ${DST.at}`);

    // Assets + assignments
    const src = (await c.query(`SELECT * FROM "tblAssets" WHERE asset_type_id=$1 ORDER BY asset_id`, [SRC.at])).rows;
    const seqAst = Number((await c.query(`SELECT last_number FROM "tblIDSequences" WHERE table_key='asset'`)).rows[0]?.last_number || 0);
    const maxAst = Number((await c.query(`SELECT COALESCE(MAX(SUBSTRING(asset_id FROM 4)::int),0) n FROM "tblAssets" WHERE asset_id ~ '^AST[0-9]+$'`)).rows[0].n);
    let ast = Math.max(seqAst, maxAst);
    const cols = Object.keys(src[0]);
    const stamp = Date.now();
    let serialSeq = 0;
    for (const [i, a] of src.entries()) {
      ast += 1;
      serialSeq += 1;
      const assetId = `AST${String(ast).padStart(3, '0')}`;
      const deptName = a.dept_id
        ? (await c.query(`SELECT text FROM "tblDepartments" WHERE dept_id=$1`, [map(DEPT, a.dept_id, 'dept')])).rows[0]?.text
        : a.location;
      const row = {
        ...a,
        asset_id: assetId,
        asset_type_id: DST.at,
        org_id: DST.org,
        serial_number: `03${String(a.serial_number).slice(2, 6)}${String(serialSeq).padStart(5, '0')}`,
        branch_id: map(BRANCH, a.branch_id, 'branch'),
        dept_id: map(DEPT, a.dept_id, 'dept'),
        purchase_vendor_id: a.purchase_vendor_id ? DST.vendor : null,
        service_vendor_id: a.service_vendor_id ? DST.vendor : null,
        prod_serv_id: DST.prodServ,
        location: deptName,
        group_id: null,
        maintsch_id: null,
        created_by: ADMIN_USER,
        created_on: new Date(),
        changed_by: ADMIN_USER,
        changed_on: new Date(),
      };
      await c.query(
        `INSERT INTO "tblAssets" (${cols.map((k) => `"${k}"`).join(',')}) VALUES (${cols.map((_, j) => `$${j + 1}`).join(',')})`,
        cols.map((k) => row[k]),
      );

      const asg = (await c.query(
        `SELECT * FROM "tblAssetAssignments" WHERE asset_id=$1 AND latest_assignment_flag=true LIMIT 1`, [a.asset_id],
      )).rows[0];
      if (asg) {
        await c.query(
          `INSERT INTO "tblAssetAssignments" (asset_assign_id, dept_id, asset_id, org_id, employee_int_id, action, action_on, action_by, latest_assignment_flag, branch_id)
           VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,true,$8)`,
          [`AA${stamp + i}`, map(DEPT, asg.dept_id, 'dept'), assetId, DST.org, asg.employee_int_id, asg.action, ADMIN_USER, map(BRANCH, asg.branch_id, 'branch')],
        );
      }
      console.log(`${assetId} ← ${a.asset_id}: serial ${row.serial_number}, ${row.branch_id}/${row.dept_id} (${deptName}), purchased ${a.purchased_on.toISOString().slice(0, 10)}${asg ? ', assigned' : ''}`);
    }
    await c.query(`UPDATE "tblIDSequences" SET last_number=GREATEST(last_number,$1) WHERE table_key='asset'`, [ast]);
    await c.query(`UPDATE "tblAssetTypes" SET last_gen_seq_no=GREATEST(COALESCE(last_gen_seq_no,0),$2) WHERE asset_type_id=$1`, [DST.at, serialSeq]);

    if (APPLY) {
      await c.query('COMMIT');
      console.log('COMMITTED');
    } else {
      await c.query('ROLLBACK');
      console.log('DRY RUN — rolled back');
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
