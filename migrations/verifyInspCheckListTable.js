const db = require('../config/db');

const verifyTable = async () => {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tblInspCheckList' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n✅ tblInspCheckList Table Structure:');
    console.log('=====================================');
    result.rows.forEach(row => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
      console.log(`  ${row.column_name}: ${row.data_type}${length} ${nullable}`);
    });
    console.log('=====================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

verifyTable();
