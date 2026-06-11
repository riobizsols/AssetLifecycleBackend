const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const TABLES = [
  'tblWFAssetMaintSch_D',
  'tblWFAssetMaintHist',
  'tblWFAssetMaintSch_H',
];

async function countRows(client, table) {
  const result = await client.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
  return result.rows[0].c;
}

async function main() {
  const client = await pool.connect();
  try {
    console.log('Row counts BEFORE:');
    for (const table of TABLES) {
      console.log(`  ${table}: ${await countRows(client, table)}`);
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM "tblWFAssetMaintSch_D"');
    await client.query('DELETE FROM "tblWFAssetMaintHist"');
    await client.query('DELETE FROM "tblWFAssetMaintSch_H"');
    await client.query('COMMIT');

    console.log('\nRow counts AFTER:');
    for (const table of TABLES) {
      console.log(`  ${table}: ${await countRows(client, table)}`);
    }
    console.log('\nDone - workflow maintenance tables cleared.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
