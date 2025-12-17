const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function createTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔄 Creating tblColumnAccessConfig table...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'migrations', 'create_column_access_config_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    await pool.query(sql);

    console.log('✅ Successfully created tblColumnAccessConfig table and indexes!');
    
    // Verify the table was created
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'tblColumnAccessConfig'
    `;
    const result = await pool.query(verifyQuery);
    
    if (result.rows.length > 0) {
      console.log('✅ Table verification: tblColumnAccessConfig exists');
      
      // Check indexes
      const indexQuery = `
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'tblColumnAccessConfig'
      `;
      const indexResult = await pool.query(indexQuery);
      console.log(`✅ Created ${indexResult.rows.length} indexes:`, indexResult.rows.map(r => r.indexname).join(', '));
    } else {
      console.error('❌ Table verification failed: tblColumnAccessConfig not found');
    }

  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
createTable();

