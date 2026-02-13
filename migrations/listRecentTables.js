const db = require('../config/db');

const listTables = async () => {
  try {
    const result = await db.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename DESC 
      LIMIT 20
    `);
    
    console.log('\n✅ Recent Tables:');
    console.log('================================');
    result.rows.forEach(row => {
      console.log(`  ${row.tablename}`);
    });
    console.log('================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

listTables();
