const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function recreateTable() {
  try {
    console.log('🔄 Dropping existing table...');
    await pool.query('DROP TABLE IF EXISTS public."tblVendorSLAs" CASCADE');
    
    console.log('🔄 Creating new table structure...');
    const sql = fs.readFileSync(path.join(__dirname, '../sql/create_tblVendorSLAs.sql'), 'utf8');
    await pool.query(sql);
    
    console.log('✅ Table tblVendorSLAs recreated successfully with new structure!');
    
    // Verify the structure
    const columnsRes = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'tblVendorSLAs' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Table columns:');
    columnsRes.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

recreateTable();

