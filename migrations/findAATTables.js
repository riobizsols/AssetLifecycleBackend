const db = require('../config/db');

const findTable = async () => {
  try {
    const result = await db.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename ILIKE 'tblaat%' 
      ORDER BY tablename
    `);
    
    console.log('\n✅ Tables starting with "tblAAT":');
    console.log('=====================================');
    if (result.rows.length === 0) {
      console.log('  No tables found');
    } else {
      result.rows.forEach(row => {
        console.log(`  ${row.tablename}`);
      });
    }
    console.log('=====================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

findTable();
