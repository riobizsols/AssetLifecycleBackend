/**
 * Sync tblApps data from GENERIC_URL to DATABASE_URL
 * 
 * This script:
 * 1. Connects to GENERIC_URL (source database)
 * 2. Connects to DATABASE_URL (target database)
 * 3. Compares tblApps data between both databases
 * 4. Inserts missing rows from source to target
 * 
 * Usage:
 *   node scripts/sync-tblApps-data.js
 */

require('dotenv').config();
const { Pool } = require('pg');

// Database connection pools
let genericPool = null;
let targetPool = null;

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

// Logging helper
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
}

// Get all rows from tblApps
async function getTblAppsData(pool, label) {
  log(`Fetching tblApps data from ${label}...`, 'INFO');
  
  try {
    const query = `SELECT * FROM "tblApps" ORDER BY app_id;`;
    const result = await pool.query(query);
    log(`Found ${result.rows.length} rows in ${label}`, 'INFO');
    return result.rows;
  } catch (error) {
    log(`Error fetching data from ${label}: ${error.message}`, 'ERROR');
    throw error;
  }
}

// Get table structure (columns)
async function getTableColumns(pool, tableName) {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position;
  `;
  const result = await pool.query(query, [tableName]);
  return result.rows;
}

// Get primary key column(s)
async function getPrimaryKeyColumns(pool, tableName) {
  const query = `
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    ORDER BY kcu.ordinal_position;
  `;
  const result = await pool.query(query, [tableName]);
  return result.rows.map(r => r.column_name);
}

// Insert missing rows
async function insertMissingRows(targetPool, sourceRows, targetRows, pkColumns) {
  log('Comparing data to find missing rows...', 'INFO');
  
  // Create a set of existing primary key values in target
  const existingKeys = new Set();
  for (const targetRow of targetRows) {
    const key = pkColumns.map(col => targetRow[col]).join('|');
    existingKeys.add(key);
  }
  
  // Find missing rows
  const missingRows = [];
  for (const sourceRow of sourceRows) {
    const key = pkColumns.map(col => sourceRow[col]).join('|');
    if (!existingKeys.has(key)) {
      missingRows.push(sourceRow);
    }
  }
  
  log(`Found ${missingRows.length} missing rows to insert`, 'INFO');
  
  if (missingRows.length === 0) {
    log('No missing rows found. Tables are in sync!', 'SUCCESS');
    return { inserted: 0, failed: 0, errors: [] };
  }
  
  // Get column names
  const columns = Object.keys(sourceRows[0]);
  const columnList = columns.map(c => `"${c}"`).join(', ');
  
  // Insert missing rows
  const results = { inserted: 0, failed: 0, errors: [] };
  
  for (let i = 0; i < missingRows.length; i++) {
    const row = missingRows[i];
    const pkValue = pkColumns.map(col => row[col]).join(', ');
    
    log(`[${i + 1}/${missingRows.length}] Inserting row with PK: ${pkValue}`, 'INFO');
    
    try {
      const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');
      const values = columns.map(col => row[col]);
      
      const insertQuery = `
        INSERT INTO "tblApps" (${columnList})
        VALUES (${placeholders})
        ON CONFLICT (app_id) DO NOTHING
        RETURNING *;
      `;
      
      const result = await targetPool.query(insertQuery, values);
      
      if (result.rows.length > 0) {
        log(`  ✅ Successfully inserted row with app_id: ${row.app_id}`, 'SUCCESS');
        results.inserted++;
      } else {
        log(`  ⚠️  Row with app_id: ${row.app_id} already exists (conflict)`, 'WARN');
      }
    } catch (error) {
      log(`  ❌ Failed to insert row with PK: ${pkValue} - ${error.message}`, 'ERROR');
      results.failed++;
      results.errors.push({
        row: pkValue,
        error: error.message
      });
    }
  }
  
  return results;
}

// Main function
async function syncTblAppsData() {
  log('='.repeat(80), 'INFO');
  log('TBLAPPS DATA SYNCHRONIZATION SCRIPT', 'INFO');
  log('='.repeat(80), 'INFO');
  log('', 'INFO');

  try {
    // Initialize database connections
    log('Connecting to databases...', 'INFO');
    
    if (!process.env.GENERIC_URL) {
      throw new Error('GENERIC_URL is not set in .env file');
    }
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set in .env file');
    }

    genericPool = createPool(process.env.GENERIC_URL, 'GENERIC_URL');
    targetPool = createPool(process.env.DATABASE_URL, 'DATABASE_URL');

    // Test connections
    log('Testing connection to GENERIC_URL...', 'DEBUG');
    await genericPool.query('SELECT NOW()');
    log('Connected to GENERIC_URL (source database)', 'SUCCESS');
    
    log('Testing connection to DATABASE_URL...', 'DEBUG');
    await targetPool.query('SELECT NOW()');
    log('Connected to DATABASE_URL (target database)', 'SUCCESS');
    log('', 'INFO');

    // Get data from both databases
    const sourceData = await getTblAppsData(genericPool, 'GENERIC_URL (source)');
    const targetData = await getTblAppsData(targetPool, 'DATABASE_URL (target)');
    
    log('', 'INFO');
    log(`Source has ${sourceData.length} rows`, 'INFO');
    log(`Target has ${targetData.length} rows`, 'INFO');
    log('', 'INFO');

    // Get primary key columns
    log('Getting primary key information...', 'DEBUG');
    const pkColumns = await getPrimaryKeyColumns(genericPool, 'tblApps');
    log(`Primary key columns: ${pkColumns.join(', ')}`, 'INFO');
    log('', 'INFO');

    // Display source data for reference
    if (sourceData.length > 0) {
      log('Source tblApps data:', 'INFO');
      sourceData.forEach((row, idx) => {
        log(`  ${idx + 1}. app_id: ${row.app_id}, org_id: ${row.org_id || 'NULL'}, app_name: ${row.app_name || 'NULL'}`, 'INFO');
      });
      log('', 'INFO');
    }

    // Display target data for reference
    if (targetData.length > 0) {
      log('Target tblApps data:', 'INFO');
      targetData.forEach((row, idx) => {
        log(`  ${idx + 1}. app_id: ${row.app_id}, org_id: ${row.org_id || 'NULL'}, app_name: ${row.app_name || 'NULL'}`, 'INFO');
      });
      log('', 'INFO');
    }

    // Insert missing rows
    const results = await insertMissingRows(targetPool, sourceData, targetData, pkColumns);
    
    log('', 'INFO');
    log('='.repeat(80), 'INFO');
    log('SYNCHRONIZATION RESULTS', 'INFO');
    log('='.repeat(80), 'INFO');
    log(`✅ Successfully inserted: ${results.inserted} rows`, 'SUCCESS');
    log(`❌ Failed to insert: ${results.failed} rows`, results.failed > 0 ? 'ERROR' : 'INFO');
    
    if (results.errors.length > 0) {
      log('', 'INFO');
      log('Errors:', 'ERROR');
      results.errors.forEach(err => {
        log(`  - Row ${err.row}: ${err.error}`, 'ERROR');
      });
    }
    
    log('', 'INFO');
    log('='.repeat(80), 'INFO');
    
    // Verify final count
    const finalTargetData = await getTblAppsData(targetPool, 'DATABASE_URL (final)');
    log(`Final row count in target: ${finalTargetData.length}`, 'INFO');
    log(`Expected row count: ${sourceData.length}`, 'INFO');
    
    if (finalTargetData.length === sourceData.length) {
      log('✅ Tables are now in sync!', 'SUCCESS');
    } else {
      log(`⚠️  Row counts don't match. Some rows may have failed to insert.`, 'WARN');
    }

  } catch (error) {
    log(`Error: ${error.message}`, 'ERROR');
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connections
    if (genericPool) await genericPool.end();
    if (targetPool) await targetPool.end();
    log('', 'INFO');
    log('Database connections closed.', 'INFO');
  }
}

// Run the script
if (require.main === module) {
  syncTblAppsData()
    .then(() => {
      log('', 'INFO');
      log('✅ Script completed successfully!', 'SUCCESS');
      process.exit(0);
    })
    .catch(error => {
      log('', 'INFO');
      log(`❌ Script failed: ${error.message}`, 'ERROR');
      process.exit(1);
    });
}

module.exports = { syncTblAppsData };
