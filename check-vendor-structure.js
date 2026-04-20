const db = require('./config/db');

(async () => {
  try {
    await db.connect();
    
    // Check if tblVendors exists
    console.log('Checking vendor-related tables...');
    
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name ILIKE '%vendor%'
    `);
    
    console.log('Vendor-related tables found:', tables.rows.map(r => r.table_name));
    
    if (tables.rows.length === 0) {
      console.log('❌ No vendor tables found!');
      
      // Check what tables exist with 'v' prefix
      const vTables = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name LIKE 'tblV%' OR table_name LIKE 'v%'
        ORDER BY table_name
      `);
      
      console.log('Tables starting with V:', vTables.rows.map(r => r.table_name));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();