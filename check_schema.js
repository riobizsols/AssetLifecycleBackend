const pool = require('./config/db');

(async () => {
  try {
    const result = await pool.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'tblAATInspCheckList'
       ORDER BY ordinal_position`
    );
    console.log('\n✅ Columns in tblAATInspCheckList:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
