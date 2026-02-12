require('dotenv').config();
const { Pool } = require('pg');

async function checkCostCenterTable() {
  const pool = new Pool({
    connectionString: process.env.GENERIC_URL,
  });

  try {
    console.log('=== Checking tblCostCenter columns ===');
    const schema = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'tblCostCenter'
      ORDER BY ordinal_position
    `);
    
    console.log('tblCostCenter columns:');
    schema.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    console.log('\n=== Sample data from tblCostCenter ===');
    const sample = await pool.query(`
      SELECT * FROM "tblCostCenter" LIMIT 3
    `);
    console.log('Sample rows:', sample.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCostCenterTable();
