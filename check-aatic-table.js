const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== CHECKING tblAATInspCheckList STRUCTURE ===\n');
    
    // Get column details
    const columns = await db.query(`
      SELECT 
        column_name, 
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tblAATInspCheckList'
      ORDER BY ordinal_position
    `);
    
    if (columns.rows.length > 0) {
      console.log(`✅ tblAATInspCheckList exists with ${columns.rows.length} columns:\n`);
      columns.rows.forEach((col, i) => {
        const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        console.log(`  ${i + 1}. ${col.column_name} - ${col.data_type}${maxLen} ${nullable}`);
      });
      
      // Check primary key
      const pk = await db.query(`
        SELECT 
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'tblAATInspCheckList'
          AND tc.constraint_type = 'PRIMARY KEY'
      `);
      
      if (pk.rows.length > 0) {
        console.log(`\n✅ Primary Key: ${pk.rows[0].column_name}`);
      }
      
    } else {
      console.log('❌ tblAATInspCheckList does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
