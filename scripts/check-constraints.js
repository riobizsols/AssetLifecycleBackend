const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function checkConstraints() {
  try {
    const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = '"tblAssetBRDet"'::regclass
    `);
    
    console.log('Constraints for tblAssetBRDet:');
    res.rows.forEach(row => {
        console.log(`${row.conname}: ${row.pg_get_constraintdef}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkConstraints();
