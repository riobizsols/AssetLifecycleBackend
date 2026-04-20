/**
 * Check tables in both databases to verify if missing tables were created
 */

require('dotenv').config();
const { Pool } = require('pg');

// Helper function to create database connection
function createPool(connectionString, label) {
  if (!connectionString) {
    throw new Error(`${label} connection string is not set in .env file`);
  }
  
  return new Pool({
    connectionString: connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

// Get all tbl* tables from a database
async function getAllTables(pool) {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'tbl%'
    ORDER BY table_name;
  `;
  const result = await pool.query(query);
  return result.rows.map(r => r.table_name);
}

async function checkTables() {
  console.log('='.repeat(80));
  console.log('TABLE COMPARISON: GENERIC_URL vs DATABASE_URL');
  console.log('='.repeat(80));
  console.log('');

  let genericPool = null;
  let targetPool = null;

  try {
    if (!process.env.GENERIC_URL) {
      throw new Error('GENERIC_URL is not set in .env file');
    }
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set in .env file');
    }

    genericPool = createPool(process.env.GENERIC_URL, 'GENERIC_URL');
    targetPool = createPool(process.env.DATABASE_URL, 'DATABASE_URL');

    console.log('Connecting to databases...');
    await genericPool.query('SELECT NOW()');
    await targetPool.query('SELECT NOW()');
    console.log('✅ Connected to both databases\n');

    // Get tables from both databases
    console.log('Fetching tables from GENERIC_URL (source)...');
    const sourceTables = await getAllTables(genericPool);
    console.log(`Found ${sourceTables.length} tables in source\n`);

    console.log('Fetching tables from DATABASE_URL (target)...');
    const targetTables = await getAllTables(targetPool);
    console.log(`Found ${targetTables.length} tables in target\n`);

    // Find missing tables
    const missingTables = sourceTables.filter(t => !targetTables.includes(t));
    const extraTables = targetTables.filter(t => !sourceTables.includes(t));
    const commonTables = sourceTables.filter(t => targetTables.includes(t));

    console.log('='.repeat(80));
    console.log('COMPARISON RESULTS');
    console.log('='.repeat(80));
    console.log(`Source (GENERIC_URL): ${sourceTables.length} tables`);
    console.log(`Target (DATABASE_URL): ${targetTables.length} tables`);
    console.log(`Common tables: ${commonTables.length}`);
    console.log(`Missing in target: ${missingTables.length}`);
    console.log(`Extra in target: ${extraTables.length}`);
    console.log('');

    if (missingTables.length > 0) {
      console.log('❌ MISSING TABLES IN TARGET (should have been created):');
      missingTables.forEach((table, idx) => {
        console.log(`  ${idx + 1}. ${table}`);
      });
      console.log('');
    } else {
      console.log('✅ All source tables exist in target database!');
      console.log('');
    }

    if (extraTables.length > 0) {
      console.log('⚠️  EXTRA TABLES IN TARGET (not in source):');
      extraTables.forEach((table, idx) => {
        console.log(`  ${idx + 1}. ${table}`);
      });
      console.log('');
    }

    // Show some common tables as confirmation
    if (commonTables.length > 0) {
      console.log(`✅ Common tables (showing first 10):`);
      commonTables.slice(0, 10).forEach((table, idx) => {
        console.log(`  ${idx + 1}. ${table}`);
      });
      if (commonTables.length > 10) {
        console.log(`  ... and ${commonTables.length - 10} more`);
      }
      console.log('');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (genericPool) await genericPool.end();
    if (targetPool) await targetPool.end();
  }
}

if (require.main === module) {
  checkTables()
    .then(() => {
      console.log('✅ Check completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error(`❌ Failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { checkTables };
