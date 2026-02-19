const { Pool } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tblInspCheckList'
    `);
    console.log('Columns in tblInspCheckList:');
    console.log(JSON.stringify(res.rows, null, 2));
    
    const dataRes = await pool.query('SELECT * FROM "tblInspCheckList" LIMIT 5');
    console.log('\nData in tblInspCheckList:');
    console.log(JSON.stringify(dataRes.rows, null, 2));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
