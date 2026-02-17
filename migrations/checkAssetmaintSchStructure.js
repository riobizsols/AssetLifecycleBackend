const db = require('../config/db');

const checkTable = async () => {
  try {
    // Get column information
    const result = await db.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'tblAssetMaintSch' 
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ tblAssetMaintSch table does not exist');
      process.exit(1);
    }
    
    console.log('\n✅ tblAssetMaintSch Table Structure:');
    console.log('===================================');
    result.rows.forEach(row => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
      const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
      console.log(`  ${row.column_name}: ${row.data_type}${length} ${nullable}${defaultVal}`);
    });
    console.log('===================================\n');
    
    // Get constraints
    const constraintResult = await db.query(`
      SELECT
        c.conname AS constraint_name,
        c.contype AS constraint_type,
        a.attname AS column_name,
        confrelid::regclass AS foreign_table_name
      FROM pg_constraint c
      LEFT JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.conrelid = (
        SELECT oid FROM pg_class WHERE relname = 'tblAssetMaintSch'
      )
      ORDER BY conname;
    `);
    
    console.log('✅ Constraints:');
    console.log('===================================');
    constraintResult.rows.forEach(row => {
      const type = row.constraint_type === 'p' ? 'PRIMARY KEY' : 
                   row.constraint_type === 'f' ? 'FOREIGN KEY' : 
                   row.constraint_type === 'u' ? 'UNIQUE' : 'CHECK';
      console.log(`  ${row.constraint_name} (${type})`);
      if (row.column_name) {
        console.log(`    Column: ${row.column_name}`);
      }
      if (row.foreign_table_name) {
        console.log(`    References: ${row.foreign_table_name}`);
      }
    });
    console.log('===================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkTable();
