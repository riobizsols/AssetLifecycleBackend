const { Pool } = require('pg');
require('dotenv').config();

async function checkTables() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('=== Checking for Inspection Checklist Tables ===\n');
    
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%insp%' AND table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Found tables:');
    res.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check tblInspCheckList columns
    console.log('\nColumns in tblInspCheckList:');
    const checklistRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tblInspCheckList'
      ORDER BY ordinal_position
    `);
    checklistRes.rows.forEach(row => console.log(`  - ${row.column_name}: ${row.data_type}`));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTables();
