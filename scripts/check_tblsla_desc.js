const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkTable() {
  try {
    console.log('🔍 Checking tblsla_desc table...\n');
    
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'tblsla_desc'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ tblsla_desc does NOT exist in DATABASE_URL database');
      console.log('   → This table needs to be created');
      return;
    }
    
    console.log('✅ tblsla_desc exists in DATABASE_URL database');
    
    // Check columns
    const columnsCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'tblsla_desc'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table columns:');
    columnsCheck.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Check data
    const dataCheck = await pool.query(`
      SELECT sla_id, description 
      FROM tblsla_desc 
      ORDER BY sla_id
    `);
    
    console.log(`\n📊 Table has ${dataCheck.rows.length} rows:`);
    dataCheck.rows.forEach(row => {
      console.log(`   - ${row.sla_id}: ${row.description}`);
    });
    
    console.log('\n✅ tblsla_desc is ready!');
    console.log('   → Dynamic schema generation will include this table in new tenant databases');
    console.log('   → Existing tenant databases need this table created manually');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkTable();

