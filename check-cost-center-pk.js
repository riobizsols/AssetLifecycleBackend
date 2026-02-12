require('dotenv').config();
const { Pool } = require('pg');

async function checkPrimaryKey() {
  const pool = new Pool({
    connectionString: process.env.GENERIC_URL,
  });

  try {
    console.log('=== Checking tblCostCenter Primary Key ===\n');

    const pkQuery = await pool.query(`
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = '"tblCostCenter"'::regclass
        AND i.indisprimary
    `);

    console.log('Primary Key columns:');
    pkQuery.rows.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });

    console.log('\n=== Checking Unique Constraints ===\n');

    const uniqueQuery = await pool.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name = 'tblCostCenter'
        AND tc.constraint_type = 'UNIQUE'
    `);

    if (uniqueQuery.rows.length > 0) {
      console.log('Unique constraints:');
      uniqueQuery.rows.forEach(row => {
        console.log(`  - ${row.constraint_name}: ${row.column_name}`);
      });
    } else {
      console.log('No unique constraints found');
    }

    console.log('\n=== Sample Data ===\n');
    const sample = await pool.query(`SELECT cc_id, cc_no, cc_name FROM "tblCostCenter" LIMIT 3`);
    console.log('Sample rows:', sample.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkPrimaryKey();
