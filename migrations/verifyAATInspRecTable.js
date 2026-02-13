const db = require('../config/db');

const verifyTable = async () => {
  try {
    // Get column information
    const result = await db.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, ['tblAAT_Insp_Rec']);
    
    console.log('\n✅ tblAAT_Insp_Rec Table Structure:');
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
        c.conname AS constraint_name,
        c.contype AS constraint_type,
        a.attname AS column_name,
        confrelid::regclass AS foreign_table_name
      FROM pg_constraint c
      LEFT JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.conrelid = (
        SELECT oid FROM pg_class WHERE relname = $1
      )
      ORDER BY conname;
    `, ['tblAAT_Insp_Rec']);
    
    console.log('✅ Constraints:');
    console.log('======================================');
    fkResult.rows.forEach(row => {
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
    console.log('======================================\n');
    
    console.log('⚠️  UI Business Rule:');
    console.log('If Recorded_Value exceeds Min_Range/Max_Range (from tblInspCheckList or tblAATInspCheckList),');
    console.log('the value MUST be displayed in RED in the UI\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

verifyTable();
