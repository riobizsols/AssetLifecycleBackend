const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== VERIFYING INSPECTION WORKFLOW TABLES ===\n');
    
    const tables = [
      'tblWFInspSteps',
      'tblWFInspJobRole',
      'tblWFAATInspSch_H',
      'tblWFAATInspSch_D',
      'tblWFAATInspHist'
    ];
    
    for (const table of tables) {
      console.log(`\n📋 ${table}:`);
      
      const columns = await db.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      if (columns.rows.length > 0) {
        console.log(`   ✅ Exists with ${columns.rows.length} columns:`);
        columns.rows.forEach((col, i) => {
          const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          console.log(`      ${i + 1}. ${col.column_name} ${col.data_type}${maxLen} ${nullable}`);
        });
        
        // Get foreign keys
        const fks = await db.query(`
          SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column,
            rc.delete_rule,
            rc.update_rule
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
          JOIN information_schema.referential_constraints rc
            ON rc.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = $1
        `, [table]);
        
        if (fks.rows.length > 0) {
          console.log(`   Foreign Keys (${fks.rows.length}):`);
          fks.rows.forEach(fk => {
            console.log(`      ${fk.column_name} → ${fk.foreign_table}.${fk.foreign_column} (ON DELETE ${fk.delete_rule})`);
          });
        }
      } else {
        console.log('   ❌ Table not found');
      }
    }
    
    console.log('\n✅ Verification complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
