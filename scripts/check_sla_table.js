const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkSLATable() {
  try {
    // Check for SLA-related tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name ILIKE '%sla%' OR table_name ILIKE '%SLA%')
      ORDER BY table_name
    `);
    
    console.log('SLA-related tables found:');
    if (result.rows.length === 0) {
      console.log('  No SLA tables found!');
      console.log('\nAll tables in public schema:');
      const allTables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      allTables.rows.forEach(r => console.log('  -', r.table_name));
    } else {
      result.rows.forEach(r => {
        console.log('  -', r.table_name);
      });
      
      // Check columns of the first SLA table found
      if (result.rows.length > 0) {
        const tableName = result.rows[0].table_name;
        console.log(`\nColumns in "${tableName}":`);
        const columns = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        columns.rows.forEach(c => {
          console.log(`  - ${c.column_name} (${c.data_type})`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSLATable();

