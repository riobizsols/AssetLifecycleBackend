/**
 * Seed a Preventive Maintenance row for AST154 (Bus) for Audit Reports.
 * Usage: node scripts/seed-ast154-preventive-maint.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

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
      ALTER TABLE "tblAssetMaintSch"
      ADD COLUMN IF NOT EXISTS actual_downtime DECIMAL(10,2);
    `);

    const { rows: assets } = await client.query(
      `SELECT asset_id, service_vendor_id, branch_id, dept_id, org_id, asset_type_id
       FROM "tblAssets" WHERE asset_id = 'AST154' LIMIT 1`,
    );
    if (!assets[0]) throw new Error('AST154 not found');
    const asset = assets[0];

    const types = await client.query(
      `SELECT maint_type_id, text FROM "tblMaintTypes" ORDER BY maint_type_id`,
    );
    console.log('Maint types:', types.rows);

    const pmType =
      types.rows.find((t) => /prevent/i.test(t.text || '')) ||
      types.rows.find((t) => /regular/i.test(t.text || '')) ||
      types.rows[0];
    if (!pmType) throw new Error('No maintenance type found');
    console.log('Using type:', pmType);

    const vendorId =
      asset.service_vendor_id ||
      (
        await client.query(
          `SELECT vendor_id FROM "tblVendors" WHERE org_id = $1 ORDER BY vendor_id LIMIT 1`,
          [asset.org_id],
        )
      ).rows[0]?.vendor_id;
    if (!vendorId) throw new Error('No vendor_id');

    const reporter = (
      await client.query(
        `SELECT user_id FROM "tblUsers" WHERE org_id = $1 ORDER BY user_id LIMIT 1`,
        [asset.org_id],
      )
    ).rows[0]?.user_id;

    const existing = await client.query(
      `SELECT ams_id FROM "tblAssetMaintSch"
       WHERE asset_id = $1 AND org_id = $2
         AND notes ILIKE '%Preventive maintenance%'
       LIMIT 1`,
      [asset.asset_id, asset.org_id],
    );

    if (existing.rows[0]) {
      console.log('Preventive maintenance already present:', existing.rows[0].ams_id);
    } else {
      const amsId = await nextAmsId(client);
      const year = new Date().getFullYear();
      const start = `${year}-05-10 09:00:00`;
      const end = `${year}-05-10 12:00:00`;
      const woId = `WO-PM-${amsId}`;

      await client.query(
        `INSERT INTO "tblAssetMaintSch" (
           ams_id, asset_id, vendor_id, maint_type_id, status, notes, technician_name,
           act_maint_st_date, act_main_end_date, created_on, created_by, org_id,
           wo_id, branch_id, dept_id, actual_downtime
         ) VALUES (
           $1, $2, $3, $4, 'CO', $5, $6,
           $7::timestamp, $8::timestamp, $7::timestamp, $9, $10,
           $11, $12, $13, $14
         )`,
        [
          amsId,
          asset.asset_id,
          vendorId,
          pmType.maint_type_id,
          'Preventive maintenance — scheduled service, fluids, brakes, and safety checks completed.',
          'Fleet Service Tech',
          start,
          end,
          reporter || 'USR001',
          asset.org_id,
          woId,
          asset.branch_id,
          asset.dept_id || null,
          2.5,
        ],
      );
      console.log('Inserted preventive maintenance', amsId, pmType.text, woId);
    }

    const list = await client.query(
      `SELECT ams_id, wo_id, status, notes, act_maint_st_date, maint_type_id, actual_downtime
       FROM "tblAssetMaintSch"
       WHERE asset_id = $1 AND org_id = $2
       ORDER BY act_maint_st_date DESC NULLS LAST`,
      [asset.asset_id, asset.org_id],
    );
    console.log('AST154 maintenance rows:', list.rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
