const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkData() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Checking Inspection Checklist Data ===\n');
    
    const res = await client.query('SELECT * FROM "tblInspCheckList"');
    console.log(`Total records: ${res.rows.length}`);
    console.log('\nRecords:');
    res.rows.forEach((row, idx) => {
      console.log(`\n${idx + 1}. ${row.insp_check_id} - ${row.inspection_text}`);
      console.log(`   Response Type: ${row.response_type}`);
      console.log(`   Created By: ${row.created_by}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkData();
