const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== CHECKING tblATInspCerts TABLE STATUS ===\n');
    
    // Check if table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tblATInspCerts'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ SUCCESS! Table "tblATInspCerts" EXISTS\n');
      
      // Get column details
      const columns = await db.query(`
        SELECT column_name, data_type, character_maximum_length, column_default
        FROM information_schema.columns 
        WHERE table_name = 'tblATInspCerts' 
        ORDER BY ordinal_position
      `);
      
      console.log(`Table has ${columns.rows.length} columns:\n`);
      columns.rows.forEach((col, i) => {
        const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  ${i + 1}. ${col.column_name} - ${col.data_type}${maxLength}${defaultVal}`);
      });
      
      // Check foreign keys
      const foreignKeys = await db.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          rc.delete_rule,
          rc.update_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = 'tblATInspCerts'
      `);
      
      if (foreignKeys.rows.length > 0) {
        console.log(`\n✅ Foreign Keys (${foreignKeys.rows.length}):\n`);
        foreignKeys.rows.forEach((fk, i) => {
          console.log(`  ${i + 1}. ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
          console.log(`     ON DELETE ${fk.delete_rule}, ON UPDATE ${fk.update_rule}`);
        });
      }
      
      // Check indexes
      const indexes = await db.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = 'tblATInspCerts'
      `);
      
      console.log(`\n✅ Indexes (${indexes.rows.length}):\n`);
      indexes.rows.forEach((idx, i) => {
        console.log(`  ${i + 1}. ${idx.indexname}`);
      });
      
      console.log('\n✅ Table is ready to use!\n');
      
    } else {
      console.log('❌ Table "tblATInspCerts" DOES NOT EXIST\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
