/**
 * Seed real (non-demo) breakdown evidence for AST154 so Audit Reports Breakdowns tab populates.
 * Usage: node scripts/seed-ast154-breakdown-audit.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function nextAbrId(client) {
  const { rows } = await client.query(`SELECT abr_id FROM "tblAssetBRDet"`);
  let max = 0;
  for (const r of rows) {
    const m = String(r.abr_id || '').match(/^ABR(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ABR${String(max + 1).padStart(3, '0')}`;
}

async function nextAmsId(client) {
  const { rows } = await client.query(`SELECT ams_id FROM "tblAssetMaintSch"`);
  let max = 0;
  for (const r of rows) {
    const m = String(r.ams_id || '').match(/^AMS(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `AMS${String(max + 1).padStart(3, '0')}`;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await client.connect();

  try {
    await client.query(`
      ALTER TABLE "tblATMaintFreq" ADD COLUMN IF NOT EXISTS downtime DECIMAL(10,2);
      ALTER TABLE "tblAssetMaintSch" ADD COLUMN IF NOT EXISTS actual_downtime DECIMAL(10,2);
      ALTER TABLE "tblAssetBRDet" ADD COLUMN IF NOT EXISTS dept_id character varying(50);
      ALTER TABLE "tblAssetBRDet" ADD COLUMN IF NOT EXISTS reopen_notes text;
    `);

    const { rows: assets } = await client.query(
      `SELECT a.asset_id, a.serial_number, a.asset_type_id, a.dept_id, a.branch_id, a.org_id,
              at.text AS asset_type_name
       FROM "tblAssets" a
       LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
       WHERE a.asset_id = $1 OR a.serial_number ILIKE $2
       LIMIT 1`,
      ['AST154', '%67620900001%'],
    );
    if (!assets[0]) throw new Error('AST154 / Bus 67620900001 not found in this database');
    const asset = assets[0];
    console.log('Asset:', asset);

    const orgId = asset.org_id;
    const typeId = asset.asset_type_id;

    let reason = (
      await client.query(
        `SELECT atbrrc_id, text FROM "tblATBRReasonCodes"
         WHERE (asset_type_id = $1 OR asset_type_id IS NULL)
           AND (org_id = $2 OR org_id IS NULL)
         ORDER BY CASE WHEN asset_type_id = $1 THEN 0 ELSE 1 END, atbrrc_id
         LIMIT 1`,
        [typeId, orgId],
      )
    ).rows[0];

    if (!reason) {
      const id = `BRC${Date.now().toString().slice(-5)}`;
      await client.query(
        `INSERT INTO "tblATBRReasonCodes" (atbrrc_id, asset_type_id, text, instatus, org_id)
         VALUES ($1, $2, $3, '1', $4)`,
        [id, typeId, 'Mechanical failure', orgId],
      );
      reason = { atbrrc_id: id, text: 'Mechanical failure' };
      console.log('Created reason code:', reason);
    } else {
      console.log('Using reason:', reason);
    }

    let deptId = asset.dept_id;
    if (!deptId) {
      deptId = (
        await client.query(
          `SELECT dept_id FROM "tblDepartments" WHERE org_id = $1 OR org_id IS NULL ORDER BY dept_id LIMIT 1`,
          [orgId],
        )
      ).rows[0]?.dept_id;
      if (deptId) {
        await client.query(`UPDATE "tblAssets" SET dept_id = $1 WHERE asset_id = $2 AND org_id = $3`, [
          deptId,
          asset.asset_id,
          orgId,
        ]);
        console.log('Set asset dept_id:', deptId);
      }
    }

    const reporter = (
      await client.query(
        `SELECT user_id FROM "tblUsers" WHERE org_id = $1 ORDER BY user_id LIMIT 1`,
        [orgId],
      )
    ).rows[0]?.user_id;

    const vendorId =
      (
        await client.query(
          `SELECT service_vendor_id FROM "tblAssets" WHERE asset_id = $1 AND org_id = $2`,
          [asset.asset_id, orgId],
        )
      ).rows[0]?.service_vendor_id ||
      (
        await client.query(
          `SELECT vendor_id FROM "tblVendors" WHERE org_id = $1 ORDER BY vendor_id LIMIT 1`,
          [orgId],
        )
      ).rows[0]?.vendor_id;
    if (!vendorId) throw new Error('No vendor_id available for maintenance row');

    // Expected downtime on maint freq (prefer MT004 / On Demand)
    const freq = (
      await client.query(
        `SELECT at_main_freq_id, text, maint_type_id, downtime
         FROM "tblATMaintFreq"
         WHERE asset_type_id = $1 AND org_id = $2 AND COALESCE(int_status, 1) = 1
         ORDER BY
           CASE WHEN maint_type_id = 'MT004' THEN 0 ELSE 1 END,
           CASE WHEN LOWER(COALESCE(text,'')) LIKE '%on demand%' THEN 0 ELSE 1 END,
           at_main_freq_id
         LIMIT 1`,
        [typeId, orgId],
      )
    ).rows[0];

    if (freq) {
      await client.query(
        `UPDATE "tblATMaintFreq" SET downtime = COALESCE(downtime, $1) WHERE at_main_freq_id = $2 AND org_id = $3`,
        [4.5, freq.at_main_freq_id, orgId],
      );
      console.log('Ensured expected downtime on', freq.at_main_freq_id);
    } else {
      console.warn('No maintenance frequency for asset type; expected downtime may be blank');
    }

    // Clear prior local audit seeds for this asset (tagged) so we don't confuse ourselves
    const year = new Date().getFullYear();
    const d1 = `${year}-03-15`;
    const d2 = `${year}-06-20`;
    const d3 = `${year}-08-10`;

    const existingSeed = await client.query(
      `SELECT abr_id, description FROM "tblAssetBRDet"
       WHERE asset_id = $1 AND org_id = $2
         AND (
           description ILIKE '%Bus failed to start during morning route%'
           OR description ILIKE '%Recurring starter issue after prior repair%'
         )`,
      [asset.asset_id, orgId],
    );

    let abr1 = existingSeed.rows.find((r) =>
      String(r.description || '').includes('Bus failed to start'),
    )?.abr_id;
    let abr2 = existingSeed.rows.find((r) =>
      String(r.description || '').includes('Recurring starter issue'),
    )?.abr_id;

    if (!abr1) {
      abr1 = await nextAbrId(client);
      await client.query(
        `INSERT INTO "tblAssetBRDet" (
           abr_id, asset_id, atbrrc_id, reported_by, is_create_maintenance,
           decision_code, status, description, org_id, created_on, branch_id, dept_id, reopen_notes
         ) VALUES (
           $1, $2, $3, $4, true, 'BF01', 'CO',
           $5, $6, $7::timestamp, $8, $9, NULL
         )`,
        [
          abr1,
          asset.asset_id,
          reason.atbrrc_id,
          reporter || null,
          'Bus failed to start during morning route. Battery and starter inspected.',
          orgId,
          `${d1} 09:30:00`,
          asset.branch_id,
          deptId || null,
        ],
      );
      console.log('Inserted breakdown', abr1);
    } else {
      console.log('Breakdown already present', abr1);
    }

    if (!abr2) {
      abr2 = await nextAbrId(client);
      await client.query(
        `INSERT INTO "tblAssetBRDet" (
           abr_id, asset_id, atbrrc_id, reported_by, is_create_maintenance,
           decision_code, status, description, org_id, created_on, branch_id, dept_id, reopen_notes
         ) VALUES (
           $1, $2, $3, $4, true, 'BF01', 'CO',
           $5, $6, $7::timestamp, $8, $9,
           'Same cause reappeared after previous repair'
         )`,
        [
          abr2,
          asset.asset_id,
          reason.atbrrc_id,
          reporter || null,
          `[Reopened: ${d3}] Recurring starter issue after prior repair. Bus out of service again.`,
          orgId,
          `${d2} 14:15:00`,
          asset.branch_id,
          deptId || null,
        ],
      );
      console.log('Inserted repeat/reopened breakdown', abr2);
    } else {
      console.log('Repeat breakdown already present', abr2);
    }

    // Linked AMS with actual downtime for abr1
    const existingAms = await client.query(
      `SELECT ams_id FROM "tblAssetMaintSch"
       WHERE asset_id = $1 AND org_id = $2
         AND (wo_id ILIKE '%' || $3 || '%' OR notes ILIKE '%' || $3 || '%')
       LIMIT 1`,
      [asset.asset_id, orgId, abr1],
    );

    if (!existingAms.rows[0]) {
      const amsId = await nextAmsId(client);
      const woId = `WO-${abr1}`;
      const maintTypeId = freq?.maint_type_id || 'MT004';
      await client.query(
        `INSERT INTO "tblAssetMaintSch" (
           ams_id, asset_id, vendor_id, status, notes, technician_name,
           act_maint_st_date, act_main_end_date, created_on, created_by, org_id,
           wo_id, branch_id, dept_id, actual_downtime, maint_type_id
         ) VALUES (
           $1, $2, $3, 'CO', $4, 'Audit Seed Tech',
           $5::timestamp, $6::timestamp, $5::timestamp, $7, $8,
           $9, $10, $11, $12, $13
         )`,
        [
          amsId,
          asset.asset_id,
          vendorId,
          `Breakdown Maintenance - ${abr1}`,
          `${d1} 10:00:00`,
          `${d1} 14:30:00`,
          reporter || 'USR001',
          orgId,
          woId,
          asset.branch_id,
          deptId || null,
          3.75,
          maintTypeId,
        ],
      );
      console.log('Inserted linked maintenance', amsId, 'actual_downtime=3.75');
    } else {
      await client.query(
        `UPDATE "tblAssetMaintSch"
         SET actual_downtime = COALESCE(actual_downtime, 3.75)
         WHERE ams_id = $1`,
        [existingAms.rows[0].ams_id],
      );
      console.log('Linked maintenance already present', existingAms.rows[0].ams_id);
    }

    const check = await client.query(
      `SELECT abr_id, status, description, atbrrc_id, dept_id, created_on
       FROM "tblAssetBRDet"
       WHERE asset_id = $1 AND created_on::date BETWEEN $2::date AND $3::date
       ORDER BY created_on`,
      [asset.asset_id, `${year}-01-01`, `${year}-12-31`],
    );
    console.log('Breakdowns in period:', check.rows);
    console.log('Done. Re-run Audit Report (current year) for AST154.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
