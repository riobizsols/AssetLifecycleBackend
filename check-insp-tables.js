const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== CHECKING INSPECTION TABLES ===\n');
    
    // Check all inspection-related tables
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%insp%'
      ORDER BY table_name
    `);
    
    console.log(`Found ${tables.rows.length} inspection-related tables:\n`);
    tables.rows.forEach((table, i) => {
      console.log(`  ${i + 1}. ${table.table_name}`);
    });
    
    // Also check tblTechCerts
    const techCerts = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name ILIKE 'tblTechCerts'
    `);
    
    console.log(`\n=== CHECKING tblTechCerts ===\n`);
    if (techCerts.rows.length > 0) {
      console.log(`✅ Found: ${techCerts.rows[0].table_name}`);
      
      // Get column details
      const columns = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [techCerts.rows[0].table_name]);
      
      console.log(`\nColumns in ${techCerts.rows[0].table_name}:\n`);
      columns.rows.forEach((col, i) => {
        console.log(`  ${i + 1}. ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('❌ tblTechCerts does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
