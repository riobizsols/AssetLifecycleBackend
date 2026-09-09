/**
 * Seed tblSPCatATMap (CatATMap) for Fire Extinguisher (AT010)
 * so Spare Part Request can list categories with checkboxes.
 *
 * Usage: node scripts/seed-fire-extinguisher-sp-cat-map.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
const url = (base || process.env.DATABASE_URL).includes('/hospitality')
  ? base || process.env.DATABASE_URL
  : (base || process.env.DATABASE_URL).replace(/\/([^/?]+)(\?|$)/, '/hospitality$2');

const ORG_ID = 'ORG001';
const ASSET_TYPE_ID = 'AT010'; // Fire Extinguisher
const MAPPINGS = [
  { spc_id: 'SPC005', brand: null, model: null }, // cable
  { spc_id: 'SPC006', brand: null, model: null }, // nostle
  { spc_id: 'SPC001', brand: null, model: null }, // Filters
  { spc_id: 'SPC004', brand: null, model: null }, // Air filter
];

(async () => {
  const pool = new Pool({ connectionString: url, ssl: false, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const maxRes = await client.query(`
      SELECT COALESCE(MAX(
        CASE WHEN spcatm_id ~ '^SPCATM[0-9]+$'
          THEN CAST(SUBSTRING(spcatm_id FROM 7) AS INTEGER) ELSE 0 END
      ), 0) AS n
      FROM "tblSPCatATMap"
    `);
    let next = Number(maxRes.rows[0].n || 0);

    for (const m of MAPPINGS) {
      const exists = await client.query(
        `
          SELECT spcatm_id FROM "tblSPCatATMap"
          WHERE org_id = $1 AND asset_type_id = $2 AND spc_id = $3 AND int_status = 1
          LIMIT 1
        `,
        [ORG_ID, ASSET_TYPE_ID, m.spc_id]
      );
      if (exists.rows.length) {
        console.log(`= already mapped ${m.spc_id}`);
        continue;
      }

      const cat = await client.query(
        `SELECT spc_id, text FROM "tblSPCategory" WHERE spc_id = $1 AND org_id = $2 AND int_status = 1`,
        [m.spc_id, ORG_ID]
      );
      if (!cat.rows.length) {
        console.log(`! skip missing category ${m.spc_id}`);
        continue;
      }

      next += 1;
      const id = `SPCATM${String(next).padStart(3, '0')}`;
      await client.query(
        `
          INSERT INTO "tblSPCatATMap" (
            spcatm_id, spc_id, asset_type_id, brand, model, int_status,
            org_id, branch_id, created_by, created_on, changed_by, changed_on
          ) VALUES (
            $1, $2, $3, $4, $5, 1,
            $6, NULL, 'SYSTEM', CURRENT_TIMESTAMP, 'SYSTEM', CURRENT_TIMESTAMP
          )
        `,
        [id, m.spc_id, ASSET_TYPE_ID, m.brand, m.model, ORG_ID]
      );
      console.log(`+ mapped ${m.spc_id} (${cat.rows[0].text}) -> ${ASSET_TYPE_ID} as ${id}`);
    }

    await client.query('COMMIT');

    const check = await pool.query(
      `
        SELECT m.spc_id, c.text AS category_name
        FROM "tblSPCatATMap" m
        JOIN "tblSPCategory" c ON c.spc_id = m.spc_id AND c.org_id = m.org_id
        WHERE m.asset_type_id = $1 AND m.org_id = $2 AND m.int_status = 1
        ORDER BY c.text
      `,
      [ASSET_TYPE_ID, ORG_ID]
    );
    console.log('\nFire Extinguisher categories now:');
    for (const row of check.rows) {
      console.log(`  - ${row.category_name} (${row.spc_id})`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
