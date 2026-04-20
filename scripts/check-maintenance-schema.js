const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function checkSchema() {
  const tables = ['tblAssetMaintSch', 'tblWFAssetMaintSch_H', 'tblWFAssetMaintSch_D', 'tblWFAssetMaintHist'];
  
  for (const table of tables) {
    console.log(`\n--- Schema for ${table} ---`);
    try {
      const res = await pool.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      
      if (res.rows.length === 0) {
        console.log(`Table ${table} not found.`);
        continue;
      }
      
      res.rows.forEach(row => {
        console.log(`${row.column_name}: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
      });
    } catch (err) {
      console.error(`Error checking table ${table}:`, err.message);
    }
  }
  await pool.end();
}

checkSchema();
