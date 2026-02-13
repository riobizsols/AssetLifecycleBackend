const db = require('../config/db');

const findTable = async () => {
  try {
    const result = await db.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename ILIKE '%wfatinsp%' 
      ORDER BY tablename
    `);
    
    console.log('\n✅ Tables matching "wfatinsp":');
    console.log('================================');
    if (result.rows.length === 0) {
      console.log('  No tables found');
    } else {
      result.rows.forEach(row => {
        console.log(`  ${row.tablename}`);
      });
    }
    console.log('================================\n');
    
    // Try to get columns with different case variations
    const variations = ['tblWFATInspSeqs', 'tblwfatinspseqs', '"tblWFATInspSeqs"'];
    
    for (const tableName of variations) {
      try {
        const colResult = await db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [tableName.replace(/"/g, '')]);
        
        if (colResult.rows.length > 0) {
          console.log(`✅ Found table as: ${tableName}`);
          console.log('Columns:', colResult.rows.map(r => r.column_name).join(', '));
          break;
        }
      } catch (err) {
        // Continue to next variation
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

findTable();
