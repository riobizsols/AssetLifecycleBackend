/**
 * Create missing tables in target database from source database
 * Specifically creates: tblColumnAccessConfig and tblVendorRenewal
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

// Logging helper
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
}

// Get table structure from source
async function getTableStructure(pool, tableName) {
  log(`Getting structure for ${tableName}...`, 'INFO');
  
  const query = `
    SELECT 
      c.column_name,
      c.data_type,
      c.character_maximum_length,
      c.is_nullable,
      c.column_default,
      CASE 
        WHEN pk.column_name IS NOT NULL THEN true 
        ELSE false 
      END AS is_primary_key
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
    ) pk ON c.column_name = pk.column_name
    WHERE c.table_schema = 'public'
      AND c.table_name = $1
    ORDER BY c.ordinal_position;
  `;
  
  const result = await pool.query(query, [tableName]);
  return {
    columns: result.rows.map(row => ({
      name: row.column_name,
      type: row.data_type,
      maxLength: row.character_maximum_length,
      nullable: row.is_nullable === 'YES',
      default: row.column_default,
      isPrimaryKey: row.is_primary_key
    }))
  };
}

// Generate CREATE TABLE SQL
function generateCreateTableSQL(tableName, structure) {
  const columnDefinitions = structure.columns.map(col => {
    let type = col.type.toUpperCase();
    
    // Handle specific PostgreSQL types
    if (type === 'CHARACTER VARYING' || type === 'VARCHAR') {
      if (col.maxLength) {
        type = `VARCHAR(${col.maxLength})`;
      } else {
        type = 'VARCHAR';
      }
    } else if (type === 'CHARACTER' || type === 'CHAR') {
      if (col.maxLength) {
        type = `CHAR(${col.maxLength})`;
      } else {
        type = 'CHAR';
      }
    } else if (type === 'NUMERIC' || type === 'DECIMAL') {
      type = 'NUMERIC';
    } else if (type === 'DOUBLE PRECISION') {
      type = 'DOUBLE PRECISION';
    } else if (type === 'TIMESTAMP WITHOUT TIME ZONE') {
      type = 'TIMESTAMP';
    } else if (type === 'TIMESTAMP WITH TIME ZONE') {
      type = 'TIMESTAMPTZ';
    }
    
    let def = `"${col.name}" ${type}`;
    
    if (!col.nullable) {
      def += ' NOT NULL';
    }
    
    if (col.default) {
      def += ` DEFAULT ${col.default}`;
    }
    
    return def;
  });
  
  // Find primary key columns
  const pkColumns = structure.columns
    .filter(col => col.isPrimaryKey)
    .map(col => `"${col.name}"`);
  
  let sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
  sql += '  ' + columnDefinitions.join(',\n  ');
  
  if (pkColumns.length > 0) {
    sql += `,\n  PRIMARY KEY (${pkColumns.join(', ')})`;
  }
  
  sql += '\n);';
  
  return sql;
}

// Create table in target
async function createMissingTable(targetPool, tableName, structure) {
  try {
    const sql = generateCreateTableSQL(tableName, structure);
    log(`Executing CREATE TABLE for ${tableName}...`, 'INFO');
    log(`SQL:\n${sql}`, 'DEBUG');
    
    await targetPool.query(sql);
    
    // Verify table was created
    const verifyQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    const verifyResult = await targetPool.query(verifyQuery, [tableName]);
    
    if (verifyResult.rows[0].exists) {
      return { success: true };
    } else {
      return { success: false, error: 'Table creation succeeded but verification failed' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Main function
async function createMissingTables() {
  log('='.repeat(80), 'INFO');
  log('CREATE MISSING TABLES SCRIPT', 'INFO');
  log('='.repeat(80), 'INFO');
  log('', 'INFO');

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

    log('Connecting to databases...', 'INFO');
    await genericPool.query('SELECT NOW()');
    log('Connected to GENERIC_URL (source database)', 'SUCCESS');
    
    await targetPool.query('SELECT NOW()');
    log('Connected to DATABASE_URL (target database)', 'SUCCESS');
    log('', 'INFO');

    // Tables to create
    const tablesToCreate = ['tblColumnAccessConfig', 'tblVendorRenewal'];
    
    log(`Creating ${tablesToCreate.length} missing tables...`, 'INFO');
    log('', 'INFO');

    const results = { created: [], failed: [] };

    for (let i = 0; i < tablesToCreate.length; i++) {
      const tableName = tablesToCreate[i];
      log(`[${i + 1}/${tablesToCreate.length}] Processing: ${tableName}`, 'INFO');
      
      try {
        // Get structure from source
        const structure = await getTableStructure(genericPool, tableName);
        log(`Retrieved structure: ${structure.columns.length} columns`, 'INFO');
        
        // Create in target
        const result = await createMissingTable(targetPool, tableName, structure);
        
        if (result.success) {
          log(`✅ Successfully created table: ${tableName}`, 'SUCCESS');
          results.created.push(tableName);
        } else {
          log(`❌ Failed to create table: ${tableName} - ${result.error}`, 'ERROR');
          results.failed.push({ table: tableName, error: result.error });
        }
      } catch (error) {
        log(`❌ Error processing table: ${tableName} - ${error.message}`, 'ERROR');
        results.failed.push({ table: tableName, error: error.message });
      }
      
      log('', 'INFO');
    }

    log('='.repeat(80), 'INFO');
    log('SUMMARY', 'INFO');
    log('='.repeat(80), 'INFO');
    log(`✅ Successfully created: ${results.created.length} tables`, 'SUCCESS');
    log(`❌ Failed to create: ${results.failed.length} tables`, results.failed.length > 0 ? 'ERROR' : 'INFO');
    
    if (results.failed.length > 0) {
      log('', 'INFO');
      log('Failed tables:', 'ERROR');
      results.failed.forEach(f => {
        log(`  - ${f.table}: ${f.error}`, 'ERROR');
      });
    }

  } catch (error) {
    log(`Error: ${error.message}`, 'ERROR');
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (genericPool) await genericPool.end();
    if (targetPool) await targetPool.end();
    log('', 'INFO');
    log('Database connections closed.', 'INFO');
  }
}

// Run the script
if (require.main === module) {
  createMissingTables()
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

module.exports = { createMissingTables };
