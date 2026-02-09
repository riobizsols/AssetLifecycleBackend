const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function findVarchar100() {
  try {
    const res = await pool.query(`
      SELECT table_name, column_name, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND data_type = 'character varying' 
        AND character_maximum_length = 100
        AND table_name LIKE 'tbl%'
    `);
    
    console.log('Columns with varchar(100):');
    res.rows.forEach(row => {
      console.log(`${row.table_name}.${row.column_name}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

findVarchar100();
