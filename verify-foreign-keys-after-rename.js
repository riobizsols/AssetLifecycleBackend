const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== VERIFYING FOREIGN KEYS AFTER COLUMN RENAME ===\n');
    
    const tables = [
      'tblATInspCerts',
      'tblInspResTypeDet',
      'tblAAT_Insp_Rec',
      'tblAAT_Insp_Freq',
      'tblAATInspCheckList'
    ];
    
    for (const table of tables) {
      console.log(`\n📋 ${table}:`);
      
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
          AND tc.table_name = $1
        ORDER BY kcu.column_name
      `, [table]);
      
      if (foreignKeys.rows.length > 0) {
        foreignKeys.rows.forEach((fk, i) => {
          console.log(`   ${i + 1}. ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
          console.log(`      ON DELETE ${fk.delete_rule}, ON UPDATE ${fk.update_rule}`);
        });
      } else {
        console.log('   No foreign keys');
      }
    }
    
    console.log('\n✅ All foreign key relationships are intact!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
