const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== CHECKING DATABASE CONNECTION ===\n');
    
    // Get current database
    const dbInfo = await db.query(`SELECT current_database(), current_user`);
    console.log(`Connected to database: ${dbInfo.rows[0].current_database}`);
    console.log(`As user: ${dbInfo.rows[0].current_user}\n`);
    
    // Check all tables
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`=== ALL TABLES IN DATABASE (${tables.rows.length} tables) ===\n`);
    
    // Filter and display inspection tables
    const inspTables = tables.rows.filter(t => 
      t.table_name.toLowerCase().includes('insp') || 
      t.table_name.toLowerCase().includes('check')
    );
    
    if (inspTables.length > 0) {
      console.log('📋 Inspection-related tables:\n');
      inspTables.forEach((table, i) => {
        console.log(`  ${i + 1}. ${table.table_name}`);
      });
    } else {
      console.log('❌ No inspection-related tables found\n');
    }
    
    // Search for Tech or Cert tables
    const certTables = tables.rows.filter(t => 
      t.table_name.toLowerCase().includes('tech') || 
      t.table_name.toLowerCase().includes('cert')
    );
    
    if (certTables.length > 0) {
      console.log('\n📋 Certificate-related tables:\n');
      certTables.forEach((table, i) => {
        console.log(`  ${i + 1}. ${table.table_name}`);
      });
    } else {
      console.log('\n❌ No certificate-related tables found');
    }
    
    // Show sample of other tables
    console.log('\n📋 Sample of other tables (first 20):\n');
    tables.rows.slice(0, 20).forEach((table, i) => {
      console.log(`  ${i + 1}. ${table.table_name}`);
    });
    
    if (tables.rows.length > 20) {
      console.log(`  ... and ${tables.rows.length - 20} more tables`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
