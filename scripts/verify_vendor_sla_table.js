const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyTable() {
  try {
    // Check table columns
    const columnsRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'tblVendorSLAs' 
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Table tblVendorSLAs columns:');
    columnsRes.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });
    
    // Check ID sequence entry
    const seqRes = await pool.query(`
      SELECT table_key, last_number, prefix 
      FROM "tblIDSequences" 
      WHERE table_key = 'vendor_sla'
    `);
    
    if (seqRes.rows.length > 0) {
      console.log('\n✅ ID Sequence entry:');
      console.log('  -', JSON.stringify(seqRes.rows[0], null, 2));
    } else {
      console.log('\n⚠️  ID Sequence entry not found');
    }
    
    // Check indexes
    const indexRes = await pool.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'tblVendorSLAs'
    `);
    
    if (indexRes.rows.length > 0) {
      console.log('\n✅ Indexes:');
      indexRes.rows.forEach(idx => {
        console.log(`  - ${idx.indexname}`);
      });
    }
    
    console.log('\n✅ Verification complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyTable();

