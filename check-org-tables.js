const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== CHECKING ORGANIZATION TABLES ===\n');
    
    // Check all tables that might be for organizations
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name ILIKE '%org%' OR table_name ILIKE '%company%')
      ORDER BY table_name
    `);
    
    console.log(`Found ${tables.rows.length} organization-related tables:\n`);
    tables.rows.forEach((table, i) => {
      console.log(`  ${i + 1}. ${table.table_name}`);
    });
    
    // Check each table's structure
    if (tables.rows.length > 0) {
      console.log('\n=== TABLE STRUCTURES ===\n');
      
      for (const table of tables.rows) {
        const columns = await db.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
          LIMIT 10
        `, [table.table_name]);
        
        console.log(`${table.table_name}:`);
        columns.rows.forEach(col => {
          console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
