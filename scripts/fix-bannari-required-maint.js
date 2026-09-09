#!/usr/bin/env node

/**
 * Set required_maint = true for every asset type that has an active maintenance frequency.
 * Without this, approved maintenance AMS rows are hidden from Maintenance List.
 *
 * Usage: node scripts/fix-bannari-required-maint.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE "tblAssetTypes" at
      SET required_maint = true
      WHERE at.int_status = 1
        AND at.org_id LIKE 'BAN%'
        AND COALESCE(at.required_maint, false) IS NOT TRUE
        AND EXISTS (
          SELECT 1
          FROM "tblATMaintFreq" f
          WHERE f.asset_type_id = at.asset_type_id
            AND (f.int_status = 1 OR f.int_status IS NULL)
        )
      RETURNING at.org_id, at.asset_type_id, at.text
    `);

    await client.query('COMMIT');

    console.log(`Updated ${result.rows.length} asset types:`);
    const byOrg = {};
    for (const row of result.rows) {
      byOrg[row.org_id] = (byOrg[row.org_id] || 0) + 1;
      console.log(`  ${row.org_id} ${row.asset_type_id} ${row.text}`);
    }
    console.log('\nBy org:', byOrg);

    const verify = await client.query(`
      SELECT ams.ams_id, at.text, at.required_maint, ams.status, ams.org_id
      FROM "tblAssetMaintSch" ams
      JOIN "tblAssets" a ON a.asset_id = ams.asset_id
      JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      WHERE ams.org_id = 'BAN001'
      ORDER BY ams.created_on DESC
    `);
    console.log('\nBAN001 AMS visibility:', verify.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
