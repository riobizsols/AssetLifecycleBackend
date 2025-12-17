const db = require('./config/db');

(async () => {
  try {
    console.log('\n=== CHECKING TABLE STATUS ===\n');
    
    // Check if table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tblVendorRenewal'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ SUCCESS! Table "tblVendorRenewal" EXISTS\n');
      
      // Get column count
      const columns = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tblVendorRenewal' 
        ORDER BY ordinal_position
      `);
      
      console.log(`Table has ${columns.rows.length} columns:\n`);
      columns.rows.forEach((col, i) => {
        console.log(`  ${i + 1}. ${col.column_name} (${col.data_type})`);
      });
      
      // Check indexes
      const indexes = await db.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'tblVendorRenewal'
      `);
      
      console.log(`\nTable has ${indexes.rows.length} indexes:\n`);
      indexes.rows.forEach((idx, i) => {
        console.log(`  ${i + 1}. ${idx.indexname}`);
      });
      
      console.log('\n✅ Table is ready to use!\n');
      
    } else {
      console.log('❌ Table "tblVendorRenewal" DOES NOT EXIST\n');
      console.log('Please run: node migrations/createVendorRenewalTableStandalone.js\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
    process.exit(0);
  }
})();
