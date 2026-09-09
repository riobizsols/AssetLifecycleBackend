/**
 * Drop tblInspResType and store full Qualitative/Quantitative names
 * on tblInspResTypeDet + tblInspCheckList.response_type.
 *
 * Usage: node migrations/migrateInspResTypeFullNames.js
 */
require('dotenv').config();
const { Client } = require('pg');

async function migrate(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');

    await client.query(`DROP TABLE IF EXISTS "tblInspResType" CASCADE`);

    await client.query(`
      UPDATE "tblInspResTypeDet"
      SET name = 'Quantitative',
          changed_on = CURRENT_TIMESTAMP
      WHERE UPPER(name) = 'QN'
         OR irtd_id ILIKE 'IRTD_QN%'
    `);

    await client.query(`
      UPDATE "tblInspResTypeDet"
      SET name = 'Qualitative',
          changed_on = CURRENT_TIMESTAMP
      WHERE UPPER(name) LIKE 'QL%'
         OR irtd_id ILIKE 'IRTD_QL%'
    `);

    await client.query(`
      ALTER TABLE "tblInspCheckList"
      DROP CONSTRAINT IF EXISTS "tblInspCheckList_Response_Type_check"
    `);

    await client.query(`
      UPDATE "tblInspCheckList"
      SET response_type = 'Quantitative'
      WHERE response_type IN ('QN', 'Quantitative')
    `);

    await client.query(`
      UPDATE "tblInspCheckList"
      SET response_type = 'Qualitative'
      WHERE response_type IN ('QL', 'Qualitative')
    `);

    await client.query(`
      ALTER TABLE "tblInspCheckList"
      ADD CONSTRAINT "tblInspCheckList_Response_Type_check"
      CHECK (response_type::text = ANY (ARRAY['Qualitative'::text, 'Quantitative'::text]))
    `);

    await client.query('COMMIT');

    const det = await client.query(
      `SELECT irtd_id, name FROM "tblInspResTypeDet" ORDER BY irtd_id`
    );
    const checklist = await client.query(
      `SELECT response_type, COUNT(*)::int AS c FROM "tblInspCheckList" GROUP BY 1`
    );
    console.log('tblInspResTypeDet:', det.rows);
    console.log('tblInspCheckList response_type:', checklist.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  migrate(url)
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { migrate };
