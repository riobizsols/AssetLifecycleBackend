const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== CHECKING MAINTENANCE TABLES STRUCTURE ===\n');
    
    const tables = [
      'tblWFSteps',
      'tblWFJobRole',
      'tblWFATSeqs',
      'tblWFAssetMaintSch_H',
      'tblWFAssetMaintSch_D',
      'tblWFAssetMaintHist'
    ];
    
    for (const table of tables) {
      console.log(`\n📋 ${table}:`);
      
      const columns = await db.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      if (columns.rows.length > 0) {
        console.log(`   Found ${columns.rows.length} columns:`);
        columns.rows.forEach((col, i) => {
          const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          console.log(`   ${i + 1}. ${col.column_name} ${col.data_type}${maxLen} ${nullable}${defaultVal}`);
        });
        
        // Get primary key
        const pk = await db.query(`
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
        `, [table]);
        
        if (pk.rows.length > 0) {
          console.log(`   PK: ${pk.rows.map(r => r.column_name).join(', ')}`);
        }
        
        // Get foreign keys
        const fks = await db.query(`
          SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = $1
        `, [table]);
        
        if (fks.rows.length > 0) {
          console.log(`   FKs:`);
          fks.rows.forEach(fk => {
            console.log(`      ${fk.column_name} → ${fk.foreign_table}.${fk.foreign_column}`);
          });
        }
      } else {
        console.log('   ⚠️  Table not found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
