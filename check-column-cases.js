const db = require('./config/db');

/**
 * Check all inspection table columns for case sensitivity
 */

(async () => {
  try {
    console.log('\n=== CHECKING INSPECTION TABLE COLUMNS ===\n');
    
    const tables = [
      'tblATInspCerts',
      'tblInspResTypeDet',
      'tblAAT_Insp_Sch',
      'tblAAT_Insp_Rec',
      'tblWFATInspSeqs',
      'tblAAT_Insp_Freq',
      'tblAATInspCheckList',
      'tblInspCheckList'
    ];
    
    for (const table of tables) {
      console.log(`\n📋 ${table}:`);
      
      const columns = await db.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      if (columns.rows.length > 0) {
        console.log(`   Found ${columns.rows.length} columns:`);
        columns.rows.forEach((col, i) => {
          const hasUpperCase = col.column_name !== col.column_name.toLowerCase();
          const indicator = hasUpperCase ? '❌ NEEDS FIX' : '✅';
          const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
          console.log(`   ${indicator} ${col.column_name} - ${col.data_type}${maxLen}`);
        });
      } else {
        console.log('   ⚠️  Table not found or no columns');
      }
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
