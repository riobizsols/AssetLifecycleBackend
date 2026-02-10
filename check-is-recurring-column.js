const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkColumn() {
  try {
    console.log('Checking tblATMaintFreq table structure...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tblATMaintFreq'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in tblATMaintFreq:');
    console.log('=====================================');
    result.rows.forEach(row => {
      console.log(`Column: ${row.column_name}`);
      console.log(`  Type: ${row.data_type}`);
      console.log(`  Nullable: ${row.is_nullable}`);
      console.log(`  Default: ${row.column_default || 'None'}`);
      console.log('');
    });
    
    // Check specifically for is_recurring
    const hasIsRecurring = result.rows.some(row => row.column_name === 'is_recurring');
    
    if (hasIsRecurring) {
      console.log('✅ Column "is_recurring" EXISTS in tblATMaintFreq');
    } else {
      console.log('❌ Column "is_recurring" DOES NOT EXIST in tblATMaintFreq');
      console.log('   Migration needed to add this column.');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error checking table structure:', error);
    process.exit(1);
  }
}

checkColumn();
