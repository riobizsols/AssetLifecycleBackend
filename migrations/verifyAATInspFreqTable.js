const db = require('../config/db');

const verifyTable = async () => {
  try {
    // Get column information
    const result = await db.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'tblAAT_Insp_Freq' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n✅ tblAAT_Insp_Freq Table Structure:');
    console.log('======================================');
    result.rows.forEach(row => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
      const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
      console.log(`  ${row.column_name}: ${row.data_type}${length} ${nullable}${defaultVal}`);
    });
    console.log('======================================\n');
    
    // Get foreign key information
    const fkResult = await db.query(`
      SELECT
        conname AS constraint_name,
        conrelid::regclass AS table_name,
        a.attname AS column_name,
        confrelid::regclass AS foreign_table_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.contype = 'f'
        AND conrelid = '"tblAAT_Insp_Freq"'::regclass
      ORDER BY conname;
    `);
    
    console.log('✅ Foreign Key Constraints:');
    console.log('======================================');
    fkResult.rows.forEach(row => {
      console.log(`  ${row.constraint_name}:`);
      console.log(`    ${row.column_name} → ${row.foreign_table_name}`);
    });
    console.log('======================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

verifyTable();
