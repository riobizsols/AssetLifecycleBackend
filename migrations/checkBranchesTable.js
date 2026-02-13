const db = require('../config/db');

const checkBranchesTable = async () => {
  try {
    // Get column information
    const result = await db.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tblBranches' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n✅ tblBranches Table Structure:');
    console.log('===================================');
    result.rows.forEach(row => {
      const length = row.character_maximum_length ? `(${row.character_maximum_length})` : '';
      const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
      console.log(`  ${row.column_name}: ${row.data_type}${length} ${nullable}`);
    });
    console.log('===================================\n');
    
    // Get primary key
    const pkResult = await db.query(`
      SELECT c.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
      JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
        AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = 'tblBranches'
    `);
    
    console.log('✅ Primary Key:');
    console.log('===================================');
    pkResult.rows.forEach(row => {
      console.log(`  ${row.column_name}`);
    });
    console.log('===================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkBranchesTable();
