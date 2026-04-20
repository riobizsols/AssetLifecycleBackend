/**
 * Database Primary Key and Foreign Key Synchronization Script
 * 
 * This script:
 * 1. Connects to GENERIC_URL (source database with correct keys)
 * 2. Connects to DATABASE_URL (target database that needs keys)
 * 3. Extracts all primary keys and foreign keys from GENERIC_URL
 * 4. Compares with DATABASE_URL to find missing constraints
 * 5. Generates and applies missing constraints to DATABASE_URL
 * 
 * Usage:
 *   node scripts/sync-database-keys.js
 * 
 * Environment Variables Required:
 *   - GENERIC_URL: Source database URL (e.g., postgresql://user:pass@host:port/generic_db)
 *   - DATABASE_URL: Target database URL (e.g., postgresql://user:pass@host:port/target_db)
 * 
 * Optional Flags:
 *   --dry-run: Only generate SQL without applying
 *   --apply: Apply changes automatically (default: requires confirmation)
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const autoApply = args.includes('--apply');

// Database connection pools
let genericPool = null;
let targetPool = null;

// Logging helper with immediate flush
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  // Force flush in Node.js
  if (process.stdout.isTTY) {
    process.stdout.write('');
  }
}

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

// Helper function to get all tables
async function getAllTables(pool) {
  const query = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name LIKE 'tbl%'
    ORDER BY table_name;
  `;
  const result = await pool.query(query);
  return result.rows.map(r => r.table_name);
}

// Get table structure from source database
async function getTableStructure(pool, tableName) {
  log(`Getting table structure for: ${tableName}`, 'DEBUG');
  
  // Get columns
  const columnsQuery = `
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position;
  `;
  const columnsResult = await pool.query(columnsQuery, [tableName]);
  
  // Get primary key
  const pkQuery = `
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
  const pkResult = await pool.query(pkQuery, [tableName]);
  const pkColumns = pkResult.rows.map(r => r.column_name);
  
  return {
    columns: columnsResult.rows,
    primaryKey: pkColumns
  };
}

// Generate CREATE TABLE SQL
function generateCreateTableSQL(tableName, structure) {
  const columnDefs = structure.columns.map(col => {
    let def = `"${col.column_name}" ${col.udt_name || col.data_type}`;
    
    if (col.character_maximum_length) {
      def += `(${col.character_maximum_length})`;
    } else if (col.numeric_precision && col.numeric_scale) {
      def += `(${col.numeric_precision},${col.numeric_scale})`;
    } else if (col.numeric_precision) {
      def += `(${col.numeric_precision})`;
    }
    
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }
    
    if (col.column_default) {
      def += ` DEFAULT ${col.column_default}`;
    }
    
    return def;
  });
  
  let sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
  sql += columnDefs.join(',\n');
  
  if (structure.primaryKey.length > 0) {
    const pkCols = structure.primaryKey.map(c => `"${c}"`).join(', ');
    sql += `,\n  CONSTRAINT "pk_${tableName.toLowerCase()}" PRIMARY KEY (${pkCols})`;
  }
  
  sql += '\n);';
  
  return sql;
}

// Create missing table in target database
async function createMissingTable(targetPool, tableName, structure) {
  log(`Creating missing table: ${tableName}`, 'INFO');
  
  try {
    const createSQL = generateCreateTableSQL(tableName, structure);
    log(`Generated CREATE TABLE SQL for ${tableName}`, 'DEBUG');
    
    await targetPool.query(createSQL);
    
    // Verify table was actually created
    const verifyQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    const verifyResult = await targetPool.query(verifyQuery, [tableName]);
    
    if (!verifyResult.rows[0].exists) {
      log(`⚠️  Table ${tableName} creation query succeeded but table not found`, 'WARN');
      return { success: false, tableName, error: 'Table creation succeeded but verification failed' };
    }
    
    log(`✅ Successfully created and verified table: ${tableName}`, 'SUCCESS');
    return { success: true, tableName };
  } catch (error) {
    log(`❌ Failed to create table ${tableName}: ${error.message}`, 'ERROR');
    return { success: false, tableName, error: error.message };
  }
}

// Helper function to get primary keys for a table
async function getPrimaryKeys(pool, tableName) {
  const query = `
    SELECT 
      kcu.column_name,
      kcu.constraint_name,
      kcu.ordinal_position
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
  return result.rows.map(r => ({
    column: r.column_name,
    constraintName: r.constraint_name
  }));
}

// Helper function to get foreign keys for a table
async function getForeignKeys(pool, tableName) {
  // Use pg_catalog for more reliable foreign key retrieval (avoids duplicates)
  const query = `
    SELECT
      con.conname AS constraint_name,
      att.attname AS column_name,
      ref_class.relname AS foreign_table_name,
      ref_att.attname AS foreign_column_name,
      src.ord AS column_order,
      CASE con.confupdtype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
      END AS update_rule,
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
      END AS delete_rule
    FROM pg_constraint con
    JOIN pg_class class ON con.conrelid = class.oid
    JOIN pg_namespace nsp ON class.relnamespace = nsp.oid
    JOIN pg_class ref_class ON con.confrelid = ref_class.oid
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS src(attnum, ord) ON true
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = src.attnum
    JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS ref(attnum, ord) ON src.ord = ref.ord
    JOIN pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = ref.attnum
    WHERE con.contype = 'f'
      AND nsp.nspname = 'public'
      AND class.relname = $1
    ORDER BY con.conname, src.ord;
  `;
  const result = await pool.query(query, [tableName]);
  
  // Deduplicate by constraint_name and column combination (for composite keys)
  const seen = new Set();
  const uniqueFKs = [];
  
  for (const r of result.rows) {
    const key = `${r.constraint_name}:${r.column_name}:${r.foreign_table_name}:${r.foreign_column_name}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFKs.push({
        constraintName: r.constraint_name,
        column: r.column_name,
        referencedTable: r.foreign_table_name,
        referencedColumn: r.foreign_column_name,
        updateRule: r.update_rule,
        deleteRule: r.delete_rule
      });
    }
  }
  
  log(`  Retrieved ${uniqueFKs.length} unique foreign key constraint(s) for ${tableName}`, 'DEBUG');
  
  return uniqueFKs;
}

// Helper function to check if table exists
async function tableExists(pool, tableName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    );
  `;
  const result = await pool.query(query, [tableName]);
  return result.rows[0].exists;
}

// Helper function to check if column exists
async function columnExists(pool, tableName, columnName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    );
  `;
  const result = await pool.query(query, [tableName, columnName]);
  return result.rows[0].exists;
}

// Helper function to check if constraint exists
async function constraintExists(pool, constraintName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.table_constraints
      WHERE constraint_schema = 'public'
        AND constraint_name = $1
    );
  `;
  const result = await pool.query(query, [constraintName]);
  return result.rows[0].exists;
}

// Helper function to check if referenced table has primary key or unique constraint on the referenced column
async function referencedColumnHasConstraint(pool, tableName, columnName) {
  // Check for primary key
  const pkQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
        AND kcu.column_name = $2
    );
  `;
  const pkResult = await pool.query(pkQuery, [tableName, columnName]);
  
  if (pkResult.rows[0].exists) {
    return true;
  }
  
  // Check for unique constraint
  const uniqueQuery = `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
        AND kcu.column_name = $2
    );
  `;
  const uniqueResult = await pool.query(uniqueQuery, [tableName, columnName]);
  
  return uniqueResult.rows[0].exists;
}

// Validate data before adding primary key
async function validatePrimaryKey(pool, tableName, columns) {
  const issues = [];
  
  for (const col of columns) {
    // Check for NULL values
    const nullCheck = await pool.query(`
      SELECT COUNT(*) as null_count
      FROM "${tableName}"
      WHERE "${col.column}" IS NULL
    `);
    
    if (parseInt(nullCheck.rows[0].null_count) > 0) {
      issues.push(`Column "${col.column}" contains NULL values`);
    }
    
    // Check for duplicate values
    const duplicateCheck = await pool.query(`
      SELECT "${col.column}", COUNT(*) as count
      FROM "${tableName}"
      GROUP BY "${col.column}"
      HAVING COUNT(*) > 1
      LIMIT 5
    `);
    
    if (duplicateCheck.rows.length > 0) {
      const duplicates = duplicateCheck.rows.map(r => `${r[col.column]}: ${r.count} occurrences`).join(', ');
      issues.push(`Column "${col.column}" contains duplicate values: ${duplicates}`);
    }
  }
  
  return issues;
}

// Find orphaned records (values that don't exist in referenced table)
async function findOrphanedRecords(pool, tableName, column, referencedTable, referencedColumn) {
  // Check if referenced table exists
  const refTableExists = await tableExists(pool, referencedTable);
  if (!refTableExists) {
    return { error: `Referenced table "${referencedTable}" does not exist`, orphanedRows: [] };
  }
  
  // Check if referenced column exists
  const refColExists = await columnExists(pool, referencedTable, referencedColumn);
  if (!refColExists) {
    return { error: `Referenced column "${referencedColumn}" does not exist in table "${referencedTable}"`, orphanedRows: [] };
  }

  // Get primary key column of the table to identify rows
  const pkQuery = `
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    ORDER BY kcu.ordinal_position
    LIMIT 1;
  `;
  const pkResult = await pool.query(pkQuery, [tableName]);
  const pkColumn = pkResult.rows.length > 0 ? pkResult.rows[0].column_name : null;

  // Find orphaned records with their primary key values for identification
  const orphanQuery = pkColumn
    ? `
      SELECT 
        "${pkColumn}" as row_id,
        "${column}" as invalid_value,
        COUNT(*) OVER() as total_count
      FROM "${tableName}" t
      WHERE t."${column}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "${referencedTable}" r
          WHERE r."${referencedColumn}" = t."${column}"
        )
      ORDER BY "${pkColumn}"
      LIMIT 100;
    `
    : `
      SELECT 
        ctid::text as row_id,
        "${column}" as invalid_value,
        COUNT(*) OVER() as total_count
      FROM "${tableName}" t
      WHERE t."${column}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "${referencedTable}" r
          WHERE r."${referencedColumn}" = t."${column}"
        )
      LIMIT 100;
    `;

  const orphanResult = await pool.query(orphanQuery);
  
  // Get total count
  const countQuery = `
    SELECT COUNT(*) as orphan_count
    FROM "${tableName}" t
    WHERE t."${column}" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "${referencedTable}" r
        WHERE r."${referencedColumn}" = t."${column}"
      )
  `;
  const countResult = await pool.query(countQuery);
  const totalCount = parseInt(countResult.rows[0].orphan_count);

  return {
    error: null,
    orphanedRows: orphanResult.rows,
    totalCount: totalCount,
    pkColumn: pkColumn || 'ctid'
  };
}

// Fix orphaned records by setting invalid foreign key values to NULL
async function fixOrphanedRecords(pool, tableName, column, referencedTable, referencedColumn, orphanedInfo) {
  if (orphanedInfo.error || orphanedInfo.totalCount === 0) {
    return { fixed: 0, rows: [] };
  }

  try {
    // Get primary key column for logging
    const pkColumn = orphanedInfo.pkColumn;
    
    // Update all orphaned records to NULL
    const updateQuery = `
      UPDATE "${tableName}"
      SET "${column}" = NULL
      WHERE "${column}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "${referencedTable}" r
          WHERE r."${referencedColumn}" = "${tableName}"."${column}"
        )
    `;

    const result = await pool.query(updateQuery);
    const fixedCount = result.rowCount || 0;

    return {
      fixed: fixedCount,
      rows: orphanedInfo.orphanedRows.slice(0, 10) // Return first 10 for logging
    };
  } catch (error) {
    return {
      fixed: 0,
      rows: [],
      error: error.message
    };
  }
}

// Validate data before adding foreign key (returns info for fixing)
async function validateForeignKey(pool, tableName, column, referencedTable, referencedColumn) {
  const orphanedInfo = await findOrphanedRecords(pool, tableName, column, referencedTable, referencedColumn);
  
  if (orphanedInfo.error) {
    return { issues: [orphanedInfo.error], orphanedInfo: null };
  }
  
  if (orphanedInfo.totalCount > 0) {
    return {
      issues: [`Found ${orphanedInfo.totalCount} orphaned records that need to be fixed`],
      orphanedInfo: orphanedInfo
    };
  }
  
  return { issues: [], orphanedInfo: null };
}

// Generate SQL for adding primary key
function generatePrimaryKeySQL(tableName, columns) {
  const columnNames = columns.map(c => `"${c.column}"`).join(', ');
  const constraintName = `pk_${tableName.toLowerCase()}`;
  
  return {
    sql: `ALTER TABLE "${tableName}"\n  ADD CONSTRAINT "${constraintName}" PRIMARY KEY (${columnNames});`,
    constraintName: constraintName,
    tableName: tableName,
    columns: columns.map(c => c.column)
  };
}

// Generate SQL for adding foreign key
function generateForeignKeySQL(tableName, fk) {
  const constraintName = fk.constraintName || `fk_${tableName.toLowerCase()}_${fk.column.toLowerCase()}`;
  
  return {
    sql: `ALTER TABLE "${tableName}"\n  ADD CONSTRAINT "${constraintName}"\n  FOREIGN KEY ("${fk.column}")\n  REFERENCES "${fk.referencedTable}" ("${fk.referencedColumn}")\n  ON DELETE ${fk.deleteRule || 'SET NULL'}\n  ON UPDATE ${fk.updateRule || 'CASCADE'};`,
    constraintName: constraintName,
    tableName: tableName,
    column: fk.column,
    referencedTable: fk.referencedTable,
    referencedColumn: fk.referencedColumn
  };
}

// Apply SQL to target database
async function applySQL(pool, sql, description) {
  try {
    console.log(`  ✅ Applying: ${description}`);
    await pool.query(sql);
    return { success: true };
  } catch (error) {
    console.log(`  ❌ Failed: ${description}`);
    console.log(`     Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Prompt user for confirmation
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// Generate comprehensive report
function generateComprehensiveReport(data) {
  // Ensure migrations directory exists
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  const {
    missingPrimaryKeys = [],
    missingForeignKeys = [],
    foreignKeysToFix = [],
    fixResults = [],
    validationErrors = [],
    appliedResults = [],
    fixSQLStatements = [],
    sqlStatements = [],
    createdTables = [],
    failedTableNames = []
  } = data;

  const report = [];
  const timestamp = new Date().toISOString();
  
  report.push('='.repeat(100));
  report.push('DATABASE KEY SYNCHRONIZATION COMPREHENSIVE REPORT');
  report.push('='.repeat(100));
  report.push(`Generated: ${timestamp}`);
  report.push(`Source Database: GENERIC_URL`);
  report.push(`Target Database: DATABASE_URL`);
  report.push('='.repeat(100));
  report.push('');

  // Executive Summary
  report.push('EXECUTIVE SUMMARY');
  report.push('-'.repeat(100));
  if (createdTables.length > 0 || failedTableNames.length > 0) {
    report.push(`Tables Created: ${createdTables.length}`);
    report.push(`Tables Failed to Create: ${failedTableNames.length}`);
    report.push('');
  }
  report.push(`Total Missing Primary Keys Found: ${missingPrimaryKeys.length}`);
  report.push(`Total Missing Foreign Keys Found: ${missingForeignKeys.length}`);
  report.push(`Foreign Keys with Orphaned Records: ${foreignKeysToFix.length}`);
  report.push(`Validation Errors (Cannot be Applied): ${validationErrors.length}`);
  report.push('');
  
  const successfulPKs = appliedResults.filter(r => r.columns && r.success).length;
  const failedPKs = appliedResults.filter(r => r.columns && !r.success).length;
  const successfulFKs = appliedResults.filter(r => !r.columns && r.success).length;
  const failedFKs = appliedResults.filter(r => !r.columns && !r.success).length;
  
  report.push('APPLICATION RESULTS:');
  report.push(`  ✅ Primary Keys Applied Successfully: ${successfulPKs}`);
  report.push(`  ❌ Primary Keys Failed: ${failedPKs}`);
  report.push(`  ✅ Foreign Keys Applied Successfully: ${successfulFKs}`);
  report.push(`  ❌ Foreign Keys Failed: ${failedFKs}`);
  report.push(`  📊 Total Relationships Set: ${successfulPKs + successfulFKs}`);
  report.push(`  ⚠️  Total Relationships Not Set: ${failedPKs + failedFKs + validationErrors.length}`);
  report.push('');
  report.push('='.repeat(100));
  report.push('');

  // Section 0: Table Creation
  if (createdTables.length > 0 || failedTableNames.length > 0) {
    report.push('SECTION 0: TABLE CREATION');
    report.push('-'.repeat(100));
    if (createdTables.length > 0) {
      report.push(`Successfully Created Tables: ${createdTables.length}`);
      createdTables.forEach((table, idx) => {
        report.push(`${idx + 1}. ${table}`);
      });
      report.push('');
    }
    if (failedTableNames.length > 0) {
      report.push(`Failed to Create Tables: ${failedTableNames.length}`);
      failedTableNames.forEach((table, idx) => {
        report.push(`${idx + 1}. ${table}`);
      });
      report.push('');
    }
    report.push('');
    report.push('='.repeat(100));
    report.push('');
  }

  // Section 1: Missing Primary Keys
  if (missingPrimaryKeys.length > 0) {
    report.push('SECTION 1: MISSING PRIMARY KEYS');
    report.push('-'.repeat(100));
    report.push(`Total: ${missingPrimaryKeys.length}`);
    report.push('');
    
    for (let i = 0; i < missingPrimaryKeys.length; i++) {
      const pk = missingPrimaryKeys[i];
      const applied = appliedResults.find(r => r.tableName === pk.tableName && r.columns);
      const status = applied ? (applied.success ? '✅ APPLIED' : `❌ FAILED: ${applied.error}`) : '⏳ PENDING';
      
      report.push(`${i + 1}. Table: ${pk.tableName}`);
      report.push(`   Columns: ${pk.columns.map(c => c.column).join(', ')}`);
      report.push(`   Status: ${status}`);
      report.push('');
    }
    report.push('');
  }

  // Section 2: Missing Foreign Keys
  if (missingForeignKeys.length > 0) {
    report.push('SECTION 2: MISSING FOREIGN KEYS');
    report.push('-'.repeat(100));
    report.push(`Total: ${missingForeignKeys.length}`);
    report.push('');
    
    for (let i = 0; i < missingForeignKeys.length; i++) {
      const fk = missingForeignKeys[i];
      const applied = appliedResults.find(r => 
        r.tableName === fk.tableName && 
        r.column === fk.fk.column &&
        !r.columns
      );
      const status = applied ? (applied.success ? '✅ APPLIED' : `❌ FAILED: ${applied.error}`) : '⏳ PENDING';
      const needsFix = fk.needsFix ? ' (Had orphaned records - fixed automatically)' : '';
      
      report.push(`${i + 1}. Table: ${fk.tableName}`);
      report.push(`   Column: ${fk.fk.column}`);
      report.push(`   References: ${fk.fk.referencedTable}.${fk.fk.referencedColumn}`);
      report.push(`   Status: ${status}${needsFix}`);
      if (fk.needsFix) {
        const fixInfo = foreignKeysToFix.find(f => 
          f.tableName === fk.tableName && 
          f.fk.column === fk.fk.column
        );
        if (fixInfo) {
          const fixResult = fixResults.find(r => r.table === fk.tableName && r.column === fk.fk.column);
          if (fixResult && fixResult.success) {
            report.push(`   Orphaned Records Fixed: ${fixResult.fixed} records set to NULL`);
          } else if (fixResult && !fixResult.success) {
            report.push(`   ⚠️  Failed to fix orphaned records: ${fixResult.error}`);
          }
        }
      }
      report.push('');
    }
    report.push('');
  }

  // Section 3: Orphaned Records Fixed
  if (fixResults.length > 0) {
    report.push('SECTION 3: ORPHANED RECORDS FIXED');
    report.push('-'.repeat(100));
    report.push(`Total Foreign Keys with Orphaned Records: ${fixResults.length}`);
    report.push('');
    
    const successfulFixes = fixResults.filter(r => r.success);
    const failedFixes = fixResults.filter(r => !r.success);
    const totalRecordsFixed = successfulFixes.reduce((sum, r) => sum + (r.fixed || 0), 0);
    
    report.push(`✅ Successfully Fixed: ${successfulFixes.length} foreign key(s)`);
    report.push(`   Total Records Fixed: ${totalRecordsFixed}`);
    if (failedFixes.length > 0) {
      report.push(`❌ Failed to Fix: ${failedFixes.length} foreign key(s)`);
    }
    report.push('');
    
    for (let i = 0; i < fixResults.length; i++) {
      const fix = fixResults[i];
      const fkInfo = foreignKeysToFix.find(f => f.tableName === fix.table && f.fk.column === fix.column);
      
      report.push(`${i + 1}. Table: ${fix.table}`);
      report.push(`   Column: ${fix.column}`);
      if (fkInfo) {
        report.push(`   References: ${fkInfo.fk.referencedTable}.${fkInfo.fk.referencedColumn}`);
      }
      if (fix.success) {
        report.push(`   Status: ✅ SUCCESS`);
        report.push(`   Records Fixed: ${fix.fixed} (set to NULL)`);
      } else {
        report.push(`   Status: ❌ FAILED`);
        report.push(`   Error: ${fix.error}`);
      }
      report.push('');
    }
    report.push('');
  }

  // Section 4: Validation Errors (Cannot be Applied)
  if (validationErrors.length > 0) {
    report.push('SECTION 4: VALIDATION ERRORS (CONSTRAINTS CANNOT BE APPLIED)');
    report.push('-'.repeat(100));
    report.push(`Total: ${validationErrors.length}`);
    report.push('');
    report.push('These constraints cannot be applied due to data integrity issues.');
    report.push('Please fix the data issues manually and re-run the script.');
    report.push('');
    
    for (let i = 0; i < validationErrors.length; i++) {
      const error = validationErrors[i];
      report.push(`${i + 1}. Type: ${error.type}`);
      report.push(`   Table: ${error.table}`);
      
      if (error.type === 'PRIMARY KEY') {
        report.push(`   Columns: ${error.columns.join(', ')}`);
      } else {
        report.push(`   Column: ${error.column}`);
        report.push(`   References: ${error.referencedTable}.${error.referencedColumn}`);
      }
      
      report.push(`   Issues:`);
      error.issues.forEach(issue => {
        report.push(`     - ${issue}`);
      });
      report.push('');
    }
    report.push('');
  }

  // Section 5: Detailed Application Results
  if (appliedResults.length > 0) {
    report.push('SECTION 5: DETAILED APPLICATION RESULTS');
    report.push('-'.repeat(100));
    report.push(`Total Constraints Attempted: ${appliedResults.length}`);
    report.push('');
    
    const successful = appliedResults.filter(r => r.success);
    const failed = appliedResults.filter(r => !r.success);
    
    if (successful.length > 0) {
      report.push('✅ SUCCESSFULLY APPLIED CONSTRAINTS:');
      report.push(`   Total: ${successful.length}`);
      report.push('');
      for (let i = 0; i < successful.length; i++) {
        const result = successful[i];
        if (result.columns) {
          report.push(`   ${i + 1}. PRIMARY KEY: ${result.tableName} (${result.columns.join(', ')})`);
        } else {
          report.push(`   ${i + 1}. FOREIGN KEY: ${result.tableName}.${result.column} -> ${result.referencedTable}.${result.referencedColumn}`);
        }
      }
      report.push('');
    }
    
    if (failed.length > 0) {
      report.push('❌ FAILED TO APPLY CONSTRAINTS:');
      report.push(`   Total: ${failed.length}`);
      report.push('');
      for (let i = 0; i < failed.length; i++) {
        const result = failed[i];
        if (result.columns) {
          report.push(`   ${i + 1}. PRIMARY KEY: ${result.tableName} (${result.columns.join(', ')})`);
        } else {
          report.push(`   ${i + 1}. FOREIGN KEY: ${result.tableName}.${result.column} -> ${result.referencedTable}.${result.referencedColumn}`);
        }
        report.push(`      Error: ${result.error}`);
        report.push('');
      }
      report.push('');
    }
  }

  // Section 6: Statistics
  report.push('SECTION 6: STATISTICS');
  report.push('-'.repeat(100));
  report.push(`Primary Keys:`);
  report.push(`  - Found Missing: ${missingPrimaryKeys.length}`);
  report.push(`  - Successfully Applied: ${successfulPKs}`);
  report.push(`  - Failed to Apply: ${failedPKs}`);
  report.push(`  - Cannot Apply (Validation Errors): ${validationErrors.filter(e => e.type === 'PRIMARY KEY').length}`);
  report.push('');
  report.push(`Foreign Keys:`);
  report.push(`  - Found Missing: ${missingForeignKeys.length}`);
  report.push(`  - With Orphaned Records: ${foreignKeysToFix.length}`);
  report.push(`  - Successfully Applied: ${successfulFKs}`);
  report.push(`  - Failed to Apply: ${failedFKs}`);
  report.push(`  - Cannot Apply (Validation Errors): ${validationErrors.filter(e => e.type === 'FOREIGN KEY').length}`);
  report.push('');
  report.push(`Orphaned Records:`);
  report.push(`  - Foreign Keys with Orphaned Records: ${foreignKeysToFix.length}`);
  report.push(`  - Successfully Fixed: ${fixResults.filter(r => r.success).length}`);
  report.push(`  - Failed to Fix: ${fixResults.filter(r => !r.success).length}`);
  report.push(`  - Total Records Fixed: ${fixResults.filter(r => r.success).reduce((sum, r) => sum + (r.fixed || 0), 0)}`);
  report.push('');
  report.push(`Overall:`);
  report.push(`  - Total Relationships Set: ${successfulPKs + successfulFKs}`);
  report.push(`  - Total Relationships Not Set: ${failedPKs + failedFKs + validationErrors.length}`);
  report.push(`  - Success Rate: ${appliedResults.length > 0 ? ((successfulPKs + successfulFKs) / appliedResults.length * 100).toFixed(2) : 0}%`);
  report.push('');

  // Section 7: Recommendations
  report.push('SECTION 7: RECOMMENDATIONS');
  report.push('-'.repeat(100));
  
  if (validationErrors.length > 0) {
    report.push('⚠️  ACTION REQUIRED:');
    report.push('   There are validation errors that prevent some constraints from being applied.');
    report.push('   Please review Section 4 and fix the data issues manually.');
    report.push('   After fixing the data, re-run this script to apply the remaining constraints.');
    report.push('');
  }
  
  const failed = appliedResults.filter(r => !r.success);
  if (failed.length > 0) {
    report.push('⚠️  ACTION REQUIRED:');
    report.push('   Some constraints failed to apply. Review Section 5 for details.');
    report.push('   Common causes:');
    report.push('     - Insufficient database permissions');
    report.push('     - Constraint already exists with different name');
    report.push('     - Data type mismatches');
    report.push('   Fix the issues and re-run the script.');
    report.push('');
  }
  
  if (validationErrors.length === 0 && failed.length === 0 && appliedResults.length > 0) {
    report.push('✅ SUCCESS:');
    report.push('   All constraints were successfully applied!');
    report.push('   Your database is now synchronized with the source database.');
    report.push('');
  }
  
  if (missingPrimaryKeys.length === 0 && missingForeignKeys.length === 0) {
    report.push('✅ DATABASE IS IN SYNC:');
    report.push('   No missing constraints found. Your database already has all required keys.');
    report.push('');
  }

  report.push('='.repeat(100));
  report.push('END OF REPORT');
  report.push('='.repeat(100));

  // Save report to file
  const reportPath = path.join(migrationsDir, `sync_keys_report_${Date.now()}.txt`);
  fs.writeFileSync(reportPath, report.join('\n'));
  
  console.log('\n' + '='.repeat(80));
  console.log('📄 COMPREHENSIVE REPORT GENERATED');
  console.log('='.repeat(80));
  console.log(`Report saved to: ${reportPath}`);
  console.log('='.repeat(80));
  console.log('');
  console.log('QUICK SUMMARY:');
  console.log(`  ✅ Relationships Set: ${successfulPKs + successfulFKs}`);
  console.log(`  ❌ Relationships Not Set: ${failedPKs + failedFKs + validationErrors.length}`);
  console.log(`  🔧 Orphaned Records Fixed: ${fixResults.filter(r => r.success).reduce((sum, r) => sum + (r.fixed || 0), 0)}`);
  console.log('');
}

// Main synchronization function
async function syncDatabaseKeys() {
  // Ensure migrations directory exists
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  
  log('='.repeat(80), 'INFO');
  log('DATABASE KEY SYNCHRONIZATION SCRIPT', 'INFO');
  log('='.repeat(80), 'INFO');
  if (isDryRun) {
    log('DRY RUN MODE - No changes will be applied', 'WARN');
  }
  if (autoApply) {
    log('AUTO-APPLY MODE - Changes will be applied automatically', 'INFO');
  }

  try {
    // Initialize database connections
    log('Connecting to databases...', 'INFO');
    
    if (!process.env.GENERIC_URL) {
      throw new Error('GENERIC_URL is not set in .env file');
    }
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set in .env file');
    }

    log('Creating connection pool for GENERIC_URL...', 'DEBUG');
    genericPool = createPool(process.env.GENERIC_URL, 'GENERIC_URL');
    log('Creating connection pool for DATABASE_URL...', 'DEBUG');
    targetPool = createPool(process.env.DATABASE_URL, 'DATABASE_URL');

    // Test connections
    log('Testing connection to GENERIC_URL...', 'DEBUG');
    await genericPool.query('SELECT NOW()');
    log('Connected to GENERIC_URL (source database)', 'SUCCESS');
    
    log('Testing connection to DATABASE_URL...', 'DEBUG');
    await targetPool.query('SELECT NOW()');
    log('Connected to DATABASE_URL (target database)', 'SUCCESS');

    // Get all tables from both databases
    log('Analyzing database schemas...', 'INFO');
    log('Fetching tables from source database (GENERIC_URL)...', 'INFO');
    const genericTables = await getAllTables(genericPool);
    log(`Found ${genericTables.length} tables in source database`, 'INFO');
    
    log('Fetching tables from target database (DATABASE_URL)...', 'INFO');
    let targetTables = await getAllTables(targetPool);
    log(`Found ${targetTables.length} tables in target database`, 'INFO');
    
    log(`Source (GENERIC_URL): ${genericTables.length} tables`, 'INFO');
    log(`Target (DATABASE_URL): ${targetTables.length} tables`, 'INFO');

    // Find missing tables in target
    let missingTables = genericTables.filter(t => !targetTables.includes(t));
    let createdTables = [];
    let failedTableNames = [];
    
    // Keep trying to create missing tables until all are created or failed
    let maxIterations = 5; // Prevent infinite loops
    let iteration = 0;
    
    while (missingTables.length > 0 && iteration < maxIterations) {
      iteration++;
      
      if (iteration === 1) {
        log(`Found ${missingTables.length} missing tables in target database`, 'WARN');
        log('Missing tables: ' + missingTables.join(', '), 'WARN');
      } else {
        log(`Iteration ${iteration}: Still ${missingTables.length} missing tables remaining`, 'INFO');
      }
      
      if (!isDryRun) {
        log('Creating missing tables...', 'INFO');
        const failedTables = [];
        const newlyCreated = [];
        
        for (let i = 0; i < missingTables.length; i++) {
          const tableName = missingTables[i];
          log(`[${i + 1}/${missingTables.length}] Processing missing table: ${tableName}`, 'INFO');
          
          try {
            const structure = await getTableStructure(genericPool, tableName);
            log(`Retrieved structure for ${tableName} (${structure.columns.length} columns)`, 'DEBUG');
            
            const result = await createMissingTable(targetPool, tableName, structure);
            if (result.success) {
              newlyCreated.push(tableName);
              createdTables.push(tableName);
              log(`✅ Created table ${tableName}`, 'SUCCESS');
            } else {
              failedTables.push({ table: tableName, error: result.error });
              log(`❌ Failed to create table ${tableName}: ${result.error}`, 'ERROR');
            }
          } catch (error) {
            failedTables.push({ table: tableName, error: error.message });
            log(`❌ Error processing table ${tableName}: ${error.message}`, 'ERROR');
          }
        }
        
        log(`Table creation summary: ${newlyCreated.length} created, ${failedTables.length} failed`, 'INFO');
        if (failedTables.length > 0) {
          log('Failed tables (will be skipped in analysis):', 'ERROR');
          failedTables.forEach(f => log(`  - ${f.table}: ${f.error}`, 'ERROR'));
        }
        
        // Store failed table names to exclude from analysis
        failedTableNames = failedTables.map(f => f.table);
        
        // Refresh target tables list after creation to get accurate count
        targetTables = await getAllTables(targetPool);
        log(`Target database now has ${targetTables.length} tables (${newlyCreated.length} newly created)`, 'INFO');
        
        // Check if there are still missing tables (in case of dependencies)
        const stillMissing = genericTables.filter(t => !targetTables.includes(t) && !failedTableNames.includes(t));
        
        if (stillMissing.length === 0) {
          log('✅ All missing tables have been created!', 'SUCCESS');
          break;
        } else if (stillMissing.length === missingTables.length) {
          // No progress made, break to avoid infinite loop
          log(`⚠️  No progress made in table creation. ${stillMissing.length} tables still missing.`, 'WARN');
          missingTables = stillMissing;
          break;
        } else {
          // Some progress made, continue
          missingTables = stillMissing;
          log(`Continuing with ${missingTables.length} remaining tables...`, 'INFO');
        }
      } else {
        log('DRY RUN: Would create missing tables (not actually creating)', 'INFO');
        break;
      }
    }
    
    if (missingTables.length > 0 && !isDryRun) {
      log(`⚠️  Warning: ${missingTables.length} tables could not be created after ${iteration} iteration(s)`, 'WARN');
      log('These tables will be skipped in the analysis:', 'WARN');
      missingTables.forEach(t => log(`  - ${t}`, 'WARN'));
      failedTableNames = failedTableNames.concat(missingTables);
    } else if (missingTables.length === 0 && !isDryRun) {
      log('✅ All tables exist in target database', 'SUCCESS');
    }

    // Find common tables (exclude tables that failed to be created)
    // Use the updated targetTables list
    const commonTables = genericTables.filter(t => {
      // Skip if table creation failed
      if (failedTableNames.includes(t)) {
        log(`Skipping ${t} - table creation failed`, 'WARN');
        return false;
      }
      // Check if table exists in target (either originally or newly created)
      const exists = targetTables.includes(t);
      if (!exists && !isDryRun) {
        log(`⚠️  Table ${t} was supposed to be created but is not in target database`, 'WARN');
      }
      return exists;
    });
    log(`Found ${commonTables.length} common tables to analyze (${failedTableNames.length} skipped due to creation failures)`, 'INFO');

    // Collect missing constraints
    const missingPrimaryKeys = [];
    const missingForeignKeys = [];
    const validationErrors = [];
    const foreignKeysToFix = []; // Store foreign keys that need orphaned records fixed

    // Analyze each common table
    let tableCount = 0;
    const analysisLog = [];
    
    for (const tableName of commonTables) {
      tableCount++;
      log(`[${tableCount}/${commonTables.length}] Analyzing table: ${tableName}`, 'INFO');
      analysisLog.push(`Table ${tableCount}/${commonTables.length}: ${tableName}`);

      // Get primary keys from source
      log(`  Getting primary keys from source for ${tableName}...`, 'DEBUG');
      const sourcePKs = await getPrimaryKeys(genericPool, tableName);
      log(`  Source has ${sourcePKs.length} primary key(s)`, 'DEBUG');
      
      log(`  Getting primary keys from target for ${tableName}...`, 'DEBUG');
      const targetPKs = await getPrimaryKeys(targetPool, tableName);
      log(`  Target has ${targetPKs.length} primary key(s)`, 'DEBUG');

      // Check if table exists in target before proceeding
      const tableExistsInTarget = await tableExists(targetPool, tableName);
      if (!tableExistsInTarget) {
        log(`  ⚠️  Table ${tableName} does not exist in target database - skipping`, 'WARN');
        continue;
      }
      
      // Check for missing primary keys
      if (sourcePKs.length > 0 && targetPKs.length === 0) {
        log(`  ⚠️  Missing primary key in target: ${tableName}`, 'WARN');
        log(`  Primary key columns: ${sourcePKs.map(pk => pk.column).join(', ')}`, 'INFO');
        
        // Validate data before adding
        log(`  Validating primary key data for ${tableName}...`, 'DEBUG');
        const validationIssues = await validatePrimaryKey(targetPool, tableName, sourcePKs);
        
        if (validationIssues.length > 0) {
          log(`  ❌ Validation failed for primary key: ${validationIssues.join('; ')}`, 'ERROR');
          validationErrors.push({
            type: 'PRIMARY KEY',
            table: tableName,
            columns: sourcePKs.map(pk => pk.column),
            issues: validationIssues
          });
        } else {
          log(`  ✅ Primary key validation passed`, 'SUCCESS');
          missingPrimaryKeys.push({
            tableName,
            columns: sourcePKs
          });
        }
      } else if (sourcePKs.length > 0 && targetPKs.length > 0) {
        log(`  ✅ Primary key exists in target`, 'SUCCESS');
      }

      // Get foreign keys from source
      log(`  Getting foreign keys from source for ${tableName}...`, 'DEBUG');
      const sourceFKs = await getForeignKeys(genericPool, tableName);
      log(`  Source has ${sourceFKs.length} foreign key(s)`, 'DEBUG');
      
      log(`  Getting foreign keys from target for ${tableName}...`, 'DEBUG');
      const targetFKs = await getForeignKeys(targetPool, tableName);
      log(`  Target has ${targetFKs.length} foreign key(s)`, 'DEBUG');

      // Check for missing foreign keys
      for (const sourceFK of sourceFKs) {
        const exists = targetFKs.some(targetFK =>
          targetFK.column === sourceFK.column &&
          targetFK.referencedTable === sourceFK.referencedTable &&
          targetFK.referencedColumn === sourceFK.referencedColumn
        );

        if (!exists) {
          // Check if the column exists in the target table
          const colExists = await columnExists(targetPool, tableName, sourceFK.column);
          if (!colExists) {
            log(`    ⚠️  Skipping FK: Column "${sourceFK.column}" does not exist in target table "${tableName}"`, 'WARN');
            continue; // Skip this foreign key
          }
          
          // Check if referenced table exists
          const refTableExists = await tableExists(targetPool, sourceFK.referencedTable);
          if (!refTableExists) {
            log(`    ⚠️  Skipping FK: Referenced table "${sourceFK.referencedTable}" does not exist in target database`, 'WARN');
            validationErrors.push({
              type: 'FOREIGN KEY',
              table: tableName,
              column: sourceFK.column,
              referencedTable: sourceFK.referencedTable,
              referencedColumn: sourceFK.referencedColumn,
              issues: [`Referenced table "${sourceFK.referencedTable}" does not exist`]
            });
            continue;
          }
          
          // Check if referenced column has primary key or unique constraint
          const refHasConstraint = await referencedColumnHasConstraint(
            targetPool,
            sourceFK.referencedTable,
            sourceFK.referencedColumn
          );
          if (!refHasConstraint) {
            log(`    ⚠️  Skipping FK: Referenced table "${sourceFK.referencedTable}" does not have primary key or unique constraint on column "${sourceFK.referencedColumn}"`, 'WARN');
            validationErrors.push({
              type: 'FOREIGN KEY',
              table: tableName,
              column: sourceFK.column,
              referencedTable: sourceFK.referencedTable,
              referencedColumn: sourceFK.referencedColumn,
              issues: [`Referenced table "${sourceFK.referencedTable}" does not have a primary key or unique constraint on column "${sourceFK.referencedColumn}"`]
            });
            continue;
          }
          
          // Validate data before adding
          log(`    Checking FK: ${sourceFK.column} -> ${sourceFK.referencedTable}.${sourceFK.referencedColumn}`, 'DEBUG');
          const validationResult = await validateForeignKey(
            targetPool,
            tableName,
            sourceFK.column,
            sourceFK.referencedTable,
            sourceFK.referencedColumn
          );
          
          if (validationResult.orphanedInfo && validationResult.orphanedInfo.totalCount > 0) {
            log(`    ⚠️  Found ${validationResult.orphanedInfo.totalCount} orphaned records (will be fixed)`, 'WARN');
          } else if (validationResult.issues.length > 0 && !validationResult.orphanedInfo) {
            log(`    ❌ Validation issues: ${validationResult.issues.join('; ')}`, 'ERROR');
          } else {
            log(`    ✅ Foreign key validation passed`, 'SUCCESS');
          }

          // Check if there are orphaned records that can be fixed
          if (validationResult.orphanedInfo && validationResult.orphanedInfo.totalCount > 0) {
            // Store for fixing later
            foreignKeysToFix.push({
              tableName,
              fk: sourceFK,
              orphanedInfo: validationResult.orphanedInfo
            });
            // Still add to missing foreign keys - we'll fix the data first
            missingForeignKeys.push({
              tableName,
              fk: sourceFK,
              needsFix: true
            });
          } else if (validationResult.issues.length > 0 && !validationResult.orphanedInfo) {
            // Real validation errors (table/column doesn't exist)
            validationErrors.push({
              type: 'FOREIGN KEY',
              table: tableName,
              column: sourceFK.column,
              referencedTable: sourceFK.referencedTable,
              referencedColumn: sourceFK.referencedColumn,
              issues: validationResult.issues
            });
          } else {
            // No issues, can be added directly
            missingForeignKeys.push({
              tableName,
              fk: sourceFK,
              needsFix: false
            });
          }
        }
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('SYNCHRONIZATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Missing Primary Keys: ${missingPrimaryKeys.length}`);
    console.log(`Missing Foreign Keys: ${missingForeignKeys.length}`);
    console.log(`Validation Errors: ${validationErrors.length}`);
    console.log('='.repeat(80));
    console.log('');

    // Print orphaned records that will be fixed
    if (foreignKeysToFix.length > 0) {
      console.log('🔧 ORPHANED RECORDS FOUND (Will be fixed automatically):');
      console.log('');
      for (const fkFix of foreignKeysToFix) {
        console.log(`  Table: ${fkFix.tableName}`);
        console.log(`  Column: ${fkFix.fk.column}`);
        console.log(`  References: ${fkFix.fk.referencedTable}.${fkFix.fk.referencedColumn}`);
        console.log(`  Orphaned Records: ${fkFix.orphanedInfo.totalCount}`);
        if (fkFix.orphanedInfo.orphanedRows.length > 0) {
          console.log(`  Sample rows with invalid data:`);
          fkFix.orphanedInfo.orphanedRows.slice(0, 5).forEach(row => {
            console.log(`    - Row ID: ${row.row_id}, Invalid Value: ${row.invalid_value}`);
          });
          if (fkFix.orphanedInfo.totalCount > 5) {
            console.log(`    ... and ${fkFix.orphanedInfo.totalCount - 5} more rows`);
          }
        }
        console.log('');
      }
    }

    // Print validation errors
    if (validationErrors.length > 0) {
      console.log('⚠️  VALIDATION ERRORS (These constraints cannot be added due to data issues):');
      console.log('');
      for (const error of validationErrors) {
        console.log(`  Table: ${error.table}`);
        console.log(`  Type: ${error.type}`);
        if (error.type === 'PRIMARY KEY') {
          console.log(`  Columns: ${error.columns.join(', ')}`);
        } else {
          console.log(`  Column: ${error.column}`);
          console.log(`  References: ${error.referencedTable}.${error.referencedColumn}`);
        }
        console.log(`  Issues:`);
        error.issues.forEach(issue => console.log(`    - ${issue}`));
        console.log('');
      }
    }

    // Generate SQL for missing constraints
    const sqlStatements = [];
    const appliedResults = [];
    const fixSQLStatements = []; // SQL for fixing orphaned records

    // Generate SQL for fixing orphaned records
    if (foreignKeysToFix.length > 0) {
      console.log('📝 Generating SQL to fix orphaned records...');
      for (const fkFix of foreignKeysToFix) {
        const fixSQL = `
-- Fix orphaned records in ${fkFix.tableName}.${fkFix.fk.column}
-- Found ${fkFix.orphanedInfo.totalCount} orphaned records
UPDATE "${fkFix.tableName}"
SET "${fkFix.fk.column}" = NULL
WHERE "${fkFix.fk.column}" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "${fkFix.fk.referencedTable}" r
    WHERE r."${fkFix.fk.referencedColumn}" = "${fkFix.tableName}"."${fkFix.fk.column}"
  );
        `.trim();
        
        fixSQLStatements.push({
          sql: fixSQL,
          tableName: fkFix.tableName,
          column: fkFix.fk.column,
          referencedTable: fkFix.fk.referencedTable,
          referencedColumn: fkFix.fk.referencedColumn,
          orphanedCount: fkFix.orphanedInfo.totalCount
        });
        console.log(`  - ${fkFix.tableName}.${fkFix.fk.column}: ${fkFix.orphanedInfo.totalCount} orphaned records`);
      }
      console.log('');
    }

    // Generate primary key SQL
    if (missingPrimaryKeys.length > 0) {
      console.log('📝 Generating PRIMARY KEY constraints...');
      for (const pk of missingPrimaryKeys) {
        const pkSQL = generatePrimaryKeySQL(pk.tableName, pk.columns);
        sqlStatements.push(pkSQL);
        console.log(`  - ${pk.tableName}: ${pk.columns.map(c => c.column).join(', ')}`);
      }
      console.log('');
    }

    // Generate foreign key SQL
    if (missingForeignKeys.length > 0) {
      console.log('📝 Generating FOREIGN KEY constraints...');
      for (const fk of missingForeignKeys) {
        const fkSQL = generateForeignKeySQL(fk.tableName, fk.fk);
        sqlStatements.push(fkSQL);
        const fixNote = fk.needsFix ? ' (orphaned records will be fixed first)' : '';
        console.log(`  - ${fk.tableName}.${fk.fk.column} -> ${fk.fk.referencedTable}.${fk.fk.referencedColumn}${fixNote}`);
      }
      console.log('');
    }

    // Save SQL to file
    if (fixSQLStatements.length > 0 || sqlStatements.length > 0) {
      const sqlContent = [
        '-- =====================================================',
        '-- Database Key Synchronization SQL Script',
        `-- Generated: ${new Date().toISOString()}`,
        `-- Source: GENERIC_URL`,
        `-- Target: DATABASE_URL`,
        '-- =====================================================\n',
        'BEGIN;\n',
        ...(fixSQLStatements.length > 0 ? [
          '-- =====================================================',
          '-- STEP 1: Fix orphaned records (set invalid foreign keys to NULL)',
          '-- =====================================================\n',
          ...fixSQLStatements.map(s => `-- ${s.tableName}.${s.column} -> ${s.referencedTable}.${s.referencedColumn}\n-- Found ${s.orphanedCount} orphaned records\n${s.sql}\n`),
          '\n'
        ] : []),
        ...(sqlStatements.length > 0 ? [
          '-- =====================================================',
          '-- STEP 2: Add missing constraints',
          '-- =====================================================\n',
          ...sqlStatements.map(s => `-- ${s.tableName}: ${s.constraintName}\n${s.sql}\n`)
        ] : []),
        'COMMIT;\n',
        '-- =====================================================',
        '-- End of Script',
        '-- ====================================================='
      ].join('\n');

      const sqlPath = path.join(migrationsDir, `sync_keys_${Date.now()}.sql`);
      fs.writeFileSync(sqlPath, sqlContent);
      console.log(`💾 SQL script saved to: ${sqlPath}\n`);
    }

    // Fix orphaned records before applying foreign keys
    const fixResults = [];
    if (foreignKeysToFix.length > 0) {
      if (isDryRun) {
        console.log('🔧 Orphaned records that would be fixed (dry-run mode):\n');
        for (const fkFix of foreignKeysToFix) {
          console.log(`  ${fkFix.tableName}.${fkFix.fk.column}: ${fkFix.orphanedInfo.totalCount} records would be set to NULL`);
        }
        console.log('');
      } else {
      console.log('🔧 Fixing orphaned records...\n');
      
      for (const fkFix of foreignKeysToFix) {
        console.log(`  Fixing: ${fkFix.tableName}.${fkFix.fk.column} -> ${fkFix.fk.referencedTable}.${fkFix.fk.referencedColumn}`);
        console.log(`    Found ${fkFix.orphanedInfo.totalCount} orphaned records`);
        
        const fixResult = await fixOrphanedRecords(
          targetPool,
          fkFix.tableName,
          fkFix.fk.column,
          fkFix.fk.referencedTable,
          fkFix.fk.referencedColumn,
          fkFix.orphanedInfo
        );
        
        if (fixResult.error) {
          console.log(`    ❌ Error fixing records: ${fixResult.error}`);
          fixResults.push({
            table: fkFix.tableName,
            column: fkFix.fk.column,
            success: false,
            error: fixResult.error
          });
        } else {
          console.log(`    ✅ Fixed ${fixResult.fixed} records (set to NULL)`);
          if (fixResult.rows.length > 0) {
            console.log(`    Sample fixed rows:`);
            fixResult.rows.slice(0, 3).forEach(row => {
              console.log(`      - Row ID: ${row.row_id}, Previous Value: ${row.invalid_value}`);
            });
          }
          fixResults.push({
            table: fkFix.tableName,
            column: fkFix.fk.column,
            success: true,
            fixed: fixResult.fixed
          });
        }
        console.log('');
      }
      }
    }

    // Apply changes if not dry run
    if (!isDryRun && sqlStatements.length > 0) {
      let shouldApply = autoApply;
      
      if (!autoApply) {
        console.log('⚠️  Ready to apply changes to target database.');
        if (foreignKeysToFix.length > 0) {
          console.log(`   ${foreignKeysToFix.length} foreign key(s) had orphaned records that were fixed.`);
        }
        shouldApply = await askQuestion('Do you want to apply these changes? (y/n): ');
        console.log('');
      }

      if (shouldApply) {
        console.log('🚀 Applying changes to target database...\n');
        
        // Apply primary keys first
        const pkStatements = sqlStatements.filter(s => s.columns);
        const fkStatements = sqlStatements.filter(s => !s.columns);
        
        // Track which tables successfully got primary keys
        const tablesWithPKs = new Set();
        
        for (const sqlObj of pkStatements) {
          const description = `PRIMARY KEY on ${sqlObj.tableName} (${sqlObj.columns.join(', ')})`;
          const result = await applySQL(targetPool, sqlObj.sql, description);
          appliedResults.push({ ...sqlObj, ...result });
          
          if (result.success) {
            tablesWithPKs.add(sqlObj.tableName.toLowerCase());
            log(`✅ Primary key applied successfully for ${sqlObj.tableName}`, 'SUCCESS');
          } else {
            log(`❌ Failed to apply primary key for ${sqlObj.tableName}: ${result.error}`, 'ERROR');
          }
        }
        
        // Then apply foreign keys (with validation)
        for (const sqlObj of fkStatements) {
          // Check if referenced table has primary key or unique constraint
          const hasConstraint = await referencedColumnHasConstraint(
            targetPool,
            sqlObj.referencedTable,
            sqlObj.referencedColumn
          );
          
          if (!hasConstraint) {
            const errorMsg = `Referenced table "${sqlObj.referencedTable}" does not have a primary key or unique constraint on column "${sqlObj.referencedColumn}"`;
            log(`⚠️  Skipping FK: ${errorMsg}`, 'WARN');
            appliedResults.push({
              ...sqlObj,
              success: false,
              error: errorMsg
            });
            continue;
          }
          
          const description = `FOREIGN KEY ${sqlObj.tableName}.${sqlObj.column} -> ${sqlObj.referencedTable}.${sqlObj.referencedColumn}`;
          const result = await applySQL(targetPool, sqlObj.sql, description);
          appliedResults.push({ ...sqlObj, ...result });
          
          if (!result.success && result.error && result.error.includes('no unique constraint matching')) {
            log(`⚠️  Foreign key failed - referenced table may need primary key first: ${result.error}`, 'WARN');
          }
        }

        // Print fix results
        if (fixResults.length > 0) {
          console.log('\n' + '='.repeat(80));
          console.log('ORPHANED RECORDS FIX RESULTS');
          console.log('='.repeat(80));
          const fixedSuccess = fixResults.filter(r => r.success).length;
          const fixedFailed = fixResults.filter(r => !r.success).length;
          const totalFixed = fixResults.filter(r => r.success).reduce((sum, r) => sum + (r.fixed || 0), 0);
          console.log(`✅ Successfully fixed: ${fixedSuccess} foreign key(s)`);
          console.log(`   Total records fixed: ${totalFixed}`);
          if (fixedFailed > 0) {
            console.log(`❌ Failed to fix: ${fixedFailed} foreign key(s)`);
          }
          console.log('='.repeat(80));
        }

        // Print results
        console.log('\n' + '='.repeat(80));
        console.log('APPLICATION RESULTS');
        console.log('='.repeat(80));
        const successful = appliedResults.filter(r => r.success).length;
        const failed = appliedResults.filter(r => !r.success).length;
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log('='.repeat(80));

        // Generate comprehensive report
        generateComprehensiveReport({
          missingPrimaryKeys,
          missingForeignKeys,
          foreignKeysToFix,
          fixResults,
          validationErrors,
          appliedResults,
          fixSQLStatements,
          sqlStatements,
          createdTables,
          failedTableNames
        });
      } else {
        console.log('⏭️  Skipping application. Review the SQL file and apply manually if needed.');
        
        // Generate report even if not applied
        generateComprehensiveReport({
          missingPrimaryKeys,
          missingForeignKeys,
          foreignKeysToFix,
          fixResults: [],
          validationErrors,
          appliedResults: [],
          fixSQLStatements,
          sqlStatements,
          createdTables,
          failedTableNames
        });
      }
    } else if (isDryRun) {
      console.log('🔍 Dry run mode: SQL generated but not applied.');
      
      // Generate report for dry-run
      generateComprehensiveReport({
        missingPrimaryKeys,
        missingForeignKeys,
        foreignKeysToFix,
        fixResults: [],
        validationErrors,
        appliedResults: [],
        fixSQLStatements,
        sqlStatements,
        createdTables,
        failedTableNames
      });
    } else {
      console.log('✅ No missing constraints found. Databases are in sync!');
      
      // Generate report even when in sync
      generateComprehensiveReport({
        missingPrimaryKeys: [],
        missingForeignKeys: [],
        foreignKeysToFix: [],
        fixResults: [],
        validationErrors: [],
        appliedResults: [],
        fixSQLStatements: [],
        sqlStatements: [],
        createdTables,
        failedTableNames
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database connections
    if (genericPool) await genericPool.end();
    if (targetPool) await targetPool.end();
    console.log('\n👋 Database connections closed.');
  }
}

// Run the script
if (require.main === module) {
  syncDatabaseKeys()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { syncDatabaseKeys };
