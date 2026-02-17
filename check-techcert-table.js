const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== CHECKING tblTechCert STRUCTURE ===\n');
    
    // Get column details
    const columns = await db.query(`
      SELECT 
        column_name, 
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'tblTechCert'
      ORDER BY ordinal_position
    `);
    
    if (columns.rows.length > 0) {
      console.log(`✅ tblTechCert exists with ${columns.rows.length} columns:\n`);
      columns.rows.forEach((col, i) => {
        const maxLen = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  ${i + 1}. ${col.column_name} - ${col.data_type}${maxLen} ${nullable}${defaultVal}`);
      });
      
      // Check primary key
      const pk = await db.query(`
        SELECT a.attname 
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'tblTechCert'::regclass AND i.indisprimary
      `);
      
      if (pk.rows.length > 0) {
        console.log(`\n✅ Primary Key: ${pk.rows[0].attname}`);
      }
      
    } else {
      console.log('❌ tblTechCert does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
