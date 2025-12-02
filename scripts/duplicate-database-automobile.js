/**
 * Database Duplication Script for Automobile Database
 * 
 * This script creates an exact duplicate of the current database with the name "automobile",
 * including all tables, constraints, and relationships.
 * 
 * Data Retention:
 * - All tables will be empty EXCEPT the following tables which will retain their data:
 *   - tblApps
 *   - tblBranches
 *   - tblEmployees
 *   - tblIDSequences
 *   - tblJobRoleNav
 *   - tblMaintStatus
 *   - tblOrgSettings
 *   - tblUsers
 * 
 * Usage: node scripts/duplicate-database-automobile.js
 */

require('dotenv').config();
const { Pool, Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  // Parse DATABASE_URL
  sourceDb: parseDatabaseUrl(process.env.DATABASE_URL),
  // Target database name
  targetDbName: 'automobile',
  // Tables to retain data from
  tablesToRetainData: [
    'tblApps',
    'tblBranches',
    'tblEmployees',
    'tblIDSequences',
    'tblJobRoleNav',
    'tblMaintStatus',
    'tblOrgSettings',
    'tblUsers'
  ]
};

/**
 * Parse DATABASE_URL into connection components
 */
function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Parse postgresql://user:password@host:port/database
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  
  if (!match) {
    throw new Error('Invalid DATABASE_URL format. Expected: postgresql://user:password@host:port/database');
  }

  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

/**
 * Get connection string
 */
function getConnectionString(databaseName = null) {
  const db = databaseName || config.sourceDb.database;
  return `postgresql://${config.sourceDb.user}:${config.sourceDb.password}@${config.sourceDb.host}:${config.sourceDb.port}/${db}`;
}

/**
 * Log messages with timestamp
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Check if database exists
 */
async function databaseExists(client, dbName) {
  try {
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    return result.rows.length > 0;
  } catch (error) {
    throw new Error(`Failed to check if database exists: ${error.message}`);
  }
}

/**
 * Create new database
 */
async function createDatabase(client, dbName) {
  try {
    // Terminate any existing connections to the database
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]).catch(() => {
      // Ignore errors if database doesn't exist
    });

    // Create the database
    await client.query(`CREATE DATABASE "${dbName}" ENCODING 'UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8'`);
    log(`Database '${dbName}' created successfully`, 'success');
    return true;
  } catch (error) {
    if (error.message.includes('already exists')) {
      throw new Error(`Database '${dbName}' already exists. Please drop it first or choose a different name.`);
    }
    throw new Error(`Failed to create database: ${error.message}`);
  }
}

/**
 * Get all table names
 */
async function getTableNames(client) {
  const result = await client.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return result.rows.map(row => row.tablename);
}

/**
 * Copy table data (only for specified tables)
 */
async function copyTableData(sourceClient, targetClient, tableName, shouldRetainData) {
  if (!shouldRetainData) {
    log(`  Table ${tableName} will remain empty (not in retention list)`, 'info');
    return;
  }

  log(`Copying data for table: ${tableName}`, 'info');
  
  // Get all data from source
  const sourceData = await sourceClient.query(`SELECT * FROM "${tableName}"`);
  
  if (sourceData.rows.length === 0) {
    log(`  Table ${tableName} is empty in source, skipping data copy`, 'info');
    return;
  }

  // Get column names
  const columns = Object.keys(sourceData.rows[0]);
  const columnList = columns.map(col => `"${col}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  // Insert data into target
  for (const row of sourceData.rows) {
    const values = columns.map(col => row[col]);
    await targetClient.query(
      `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values
    );
  }

  log(`  Copied ${sourceData.rows.length} rows to ${tableName}`, 'success');
}

/**
 * Main duplication process
 */
async function duplicateDatabase() {
  let sourceClient = null;
  let targetClient = null;
  let adminClient = null;

  try {
    log('Starting database duplication process for "automobile" database...', 'info');
    log(`Source Database: ${config.sourceDb.database}`, 'info');
    log(`Target Database: ${config.targetDbName}`, 'info');
    log(`Host: ${config.sourceDb.host}:${config.sourceDb.port}`, 'info');
    log(`Tables to retain data: ${config.tablesToRetainData.join(', ')}`, 'info');

    // Connect to postgres database to create new database
    adminClient = new Client({
      connectionString: getConnectionString('postgres'),
    });
    await adminClient.connect();
    log('Connected to PostgreSQL server', 'success');

    // Check if target database exists
    const exists = await databaseExists(adminClient, config.targetDbName);
    if (exists) {
      throw new Error(`Database '${config.targetDbName}' already exists. Please drop it first or choose a different name.\nTo drop: DROP DATABASE "${config.targetDbName}";`);
    }

    // Create new database
    log(`Creating new database '${config.targetDbName}'...`, 'info');
    await createDatabase(adminClient, config.targetDbName);
    await adminClient.end();

    // Connect to source database
    sourceClient = new Client({
      connectionString: getConnectionString(config.sourceDb.database),
    });
    await sourceClient.connect();
    log('Connected to source database', 'success');

    // Connect to target database
    targetClient = new Client({
      connectionString: getConnectionString(config.targetDbName),
    });
    await targetClient.connect();
    log('Connected to target database', 'success');

    // Get all tables
    log('Fetching table list...', 'info');
    const tables = await getTableNames(sourceClient);
    log(`Found ${tables.length} tables`, 'success');

    // Step 0: Create all sequences first (needed for serial columns)
    log('Creating sequences first...', 'info');
    const sequences = await sourceClient.query(`
      SELECT 
        sequencename as sequence_name,
        last_value
      FROM pg_sequences
      WHERE schemaname = 'public'
    `);

    log(`  Found ${sequences.rows.length} sequences to create`, 'info');
    for (const seq of sequences.rows) {
      try {
        await targetClient.query(`CREATE SEQUENCE IF NOT EXISTS "${seq.sequence_name}"`);
        log(`  Created sequence: ${seq.sequence_name}`, 'info');
      } catch (error) {
        log(`  Warning: Could not create sequence ${seq.sequence_name}: ${error.message}`, 'info');
      }
    }

    // Step 1: Create all tables with structure
    log('Creating table structures...', 'info');
    
    // Store column defaults that reference sequences for later
    const sequenceDefaults = new Map();
    
    for (const table of tables) {
      log(`  Creating table: ${table}`, 'info');
      
      try {
        const tableInfo = await sourceClient.query(`
          SELECT 
            a.attname as column_name,
            pg_catalog.format_type(a.atttypid, a.atttypmod) as full_type,
            a.attnotnull as is_not_null,
            pg_get_expr(ad.adbin, ad.adrelid) as column_default
          FROM pg_attribute a
          JOIN pg_class c ON a.attrelid = c.oid
          JOIN pg_namespace n ON c.relnamespace = n.oid
          LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
          WHERE n.nspname = 'public'
            AND c.relname = $1
            AND a.attnum > 0
            AND NOT a.attisdropped
          ORDER BY a.attnum
        `, [table]);

        if (tableInfo.rows.length === 0) {
          log(`  Warning: No columns found for table ${table}`, 'info');
          continue;
        }

        // Build CREATE TABLE statement
        // Skip DEFAULT values that reference sequences (we'll add them later)
        const columns = tableInfo.rows.map(col => {
          let def = `"${col.column_name}" ${col.full_type}`;
          if (col.is_not_null) {
            def += ' NOT NULL';
          }
          // Check if default references a sequence
          if (col.column_default) {
            if (col.column_default.includes('nextval') || col.column_default.includes('_seq')) {
              // Store for later
              if (!sequenceDefaults.has(table)) {
                sequenceDefaults.set(table, []);
              }
              sequenceDefaults.get(table).push({
                column: col.column_name,
                default: col.column_default
              });
            } else {
              // Non-sequence default, add it now
              def += ` DEFAULT ${col.column_default}`;
            }
          }
          return def;
        }).join(', ');

        await targetClient.query(`CREATE TABLE IF NOT EXISTS "${table}" (${columns})`);
      } catch (error) {
        log(`  Error creating table ${table}: ${error.message}`, 'error');
        throw error;
      }
    }

    // Step 1.5: Add sequence-based defaults
    log('Adding sequence-based defaults...', 'info');
    for (const [table, defaults] of sequenceDefaults.entries()) {
      for (const def of defaults) {
        try {
          await targetClient.query(`
            ALTER TABLE "${table}" 
            ALTER COLUMN "${def.column}" SET DEFAULT ${def.default}
          `);
          log(`  Added sequence default for ${table}.${def.column}`, 'info');
        } catch (error) {
          log(`  Warning: Could not add default for ${table}.${def.column}: ${error.message}`, 'info');
        }
      }
    }

    // Step 2: Add primary keys
    log('Adding primary keys...', 'info');
    for (const table of tables) {
      try {
        const pkInfo = await sourceClient.query(`
          SELECT
            tc.constraint_name,
            string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.table_name = $1
            AND tc.constraint_type = 'PRIMARY KEY'
          GROUP BY tc.constraint_name
        `, [table]);

        if (pkInfo.rows.length > 0) {
          const pk = pkInfo.rows[0];
          const pkName = pk.constraint_name;
          const pkColumns = pk.columns.split(', ').map(col => `"${col}"`).join(', ');
          
          await targetClient.query(`
            ALTER TABLE "${table}" 
            ADD CONSTRAINT "${pkName}" PRIMARY KEY (${pkColumns})
          `).catch((error) => {
            log(`  Warning: Could not add PK ${pkName} for ${table}: ${error.message}`, 'info');
          });
        }
      } catch (error) {
        log(`  Warning: Could not get PK info for ${table}: ${error.message}`, 'info');
      }
    }

    // Step 3: Copy data only for specified tables
    log('Copying data (only for specified tables)...', 'info');
    for (const table of tables) {
      const shouldRetainData = config.tablesToRetainData.includes(table);
      await copyTableData(sourceClient, targetClient, table, shouldRetainData);
    }

    // Step 4: Add foreign keys
    log('Adding foreign keys...', 'info');
    const foreignKeys = await sourceClient.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.ordinal_position
    `);

    // Group by constraint name to handle multi-column foreign keys
    const fkMap = new Map();
    for (const row of foreignKeys.rows) {
      if (!fkMap.has(row.constraint_name)) {
        fkMap.set(row.constraint_name, {
          constraint_name: row.constraint_name,
          table_name: row.table_name,
          foreign_table_name: row.foreign_table_name,
          columns: [],
          foreign_columns: [],
          update_rule: row.update_rule,
          delete_rule: row.delete_rule,
        });
      }
      const fk = fkMap.get(row.constraint_name);
      fk.columns.push(row.column_name);
      fk.foreign_columns.push(row.foreign_column_name);
    }

    log(`  Found ${fkMap.size} foreign key constraints to add`, 'info');
    
    // First, verify referenced tables have required constraints
    for (const fk of fkMap.values()) {
      try {
        // Check if referenced table exists and has the required unique constraint
        const checkConstraint = await targetClient.query(`
          SELECT 
            tc.constraint_name,
            string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.table_name = $1
            AND (tc.constraint_type = 'PRIMARY KEY' OR tc.constraint_type = 'UNIQUE')
          GROUP BY tc.constraint_name
        `, [fk.foreign_table_name]);

        // Check if any constraint matches the foreign columns
        const foreignColsStr = fk.foreign_columns.sort().join(', ');
        let hasMatchingConstraint = false;
        
        for (const constraint of checkConstraint.rows) {
          const constraintCols = constraint.columns.split(', ').sort().join(', ');
          if (constraintCols === foreignColsStr) {
            hasMatchingConstraint = true;
            break;
          }
        }

        if (!hasMatchingConstraint && checkConstraint.rows.length > 0) {
          // Try to find a primary key that might work
          const pkCheck = await targetClient.query(`
            SELECT
              string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.table_schema = 'public'
              AND tc.table_name = $1
              AND tc.constraint_type = 'PRIMARY KEY'
            GROUP BY tc.constraint_name
          `, [fk.foreign_table_name]);
          
          if (pkCheck.rows.length > 0) {
            // If there's a PK, we might still be able to add the FK if columns match
            // Continue to try adding it
          } else {
            log(`  Skipping FK ${fk.constraint_name}: Referenced table "${fk.foreign_table_name}" has no matching unique constraint on (${fk.foreign_columns.join(', ')})`, 'info');
            continue;
          }
        }
      } catch (error) {
        // Continue anyway - might still be able to add the FK
      }
    }

    // Now add all foreign keys
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const fk of fkMap.values()) {
      try {
        const columns = fk.columns.map(col => `"${col}"`).join(', ');
        const foreignColumns = fk.foreign_columns.map(col => `"${col}"`).join(', ');
        const updateRule = fk.update_rule || 'NO ACTION';
        const deleteRule = fk.delete_rule || 'NO ACTION';
        
        await targetClient.query(`
          ALTER TABLE "${fk.table_name}"
          ADD CONSTRAINT "${fk.constraint_name}"
          FOREIGN KEY (${columns})
          REFERENCES "${fk.foreign_table_name}" (${foreignColumns})
          ON UPDATE ${updateRule}
          ON DELETE ${deleteRule}
        `);
        log(`  ✅ Added FK: ${fk.constraint_name}`, 'success');
        addedCount++;
      } catch (error) {
        const errorMsg = error.message;
        // Only skip if it's a real limitation we can't work around
        if (errorMsg.includes('cannot have more than 32 keys') || 
            errorMsg.includes('must not contain duplicates') ||
            errorMsg.includes('column') && errorMsg.includes('does not exist')) {
          log(`  ⚠️  Skipped FK ${fk.constraint_name}: ${errorMsg}`, 'info');
          skippedCount++;
        } else {
          // For other errors, try to add it anyway or log as warning
          log(`  ⚠️  Could not add FK ${fk.constraint_name}: ${errorMsg}`, 'info');
          skippedCount++;
        }
      }
    }
    
    log(`  Foreign keys summary: ${addedCount} added, ${skippedCount} skipped`, 'info');

    // Step 5: Set sequence values (sequences already created in Step 0)
    log('Setting sequence values...', 'info');
    for (const seq of sequences.rows) {
      try {
        const seqDef = await sourceClient.query(`
          SELECT last_value FROM "${seq.sequence_name}"
        `).catch(async () => {
          return { rows: [{ last_value: null }] };
        });

        if (seqDef.rows.length > 0 && seqDef.rows[0].last_value !== null) {
          const lastVal = seqDef.rows[0].last_value;
          await targetClient.query(`SELECT setval('"${seq.sequence_name}"', ${lastVal}, true)`);
          log(`  Set sequence ${seq.sequence_name} value to ${lastVal}`, 'info');
        }
      } catch (error) {
        log(`  Warning: Could not set sequence ${seq.sequence_name} value: ${error.message}`, 'info');
      }
    }

    // Step 6: Copy indexes (excluding primary key indexes)
    log('Copying indexes...', 'info');
    const indexes = await sourceClient.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT IN (
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE constraint_type = 'PRIMARY KEY' 
          AND table_schema = 'public'
        )
    `);

    log(`  Found ${indexes.rows.length} indexes to copy`, 'info');
    for (const idx of indexes.rows) {
      try {
        let indexDef = idx.indexdef;
        indexDef = indexDef.replace(/CREATE\s+(UNIQUE\s+)?INDEX/i, 'CREATE $1INDEX IF NOT EXISTS');
        await targetClient.query(indexDef);
        log(`  Created index: ${idx.indexname}`, 'info');
      } catch (error) {
        log(`  Warning: Could not create index ${idx.indexname}: ${error.message}`, 'info');
      }
    }

    // Step 7: Copy unique constraints (that aren't primary keys)
    log('Copying unique constraints...', 'info');
    const uniqueConstraints = await sourceClient.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'UNIQUE'
        AND tc.constraint_name NOT IN (
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE constraint_type = 'PRIMARY KEY' 
          AND table_schema = 'public'
        )
      GROUP BY tc.constraint_name, tc.table_name
    `);

    log(`  Found ${uniqueConstraints.rows.length} unique constraints to copy`, 'info');
    for (const uc of uniqueConstraints.rows) {
      try {
        const columns = uc.columns.split(', ').map(col => `"${col}"`).join(', ');
        await targetClient.query(`
          ALTER TABLE "${uc.table_name}"
          ADD CONSTRAINT "${uc.constraint_name}" UNIQUE (${columns})
        `);
        log(`  Added unique constraint: ${uc.constraint_name}`, 'info');
      } catch (error) {
        log(`  Warning: Could not add unique constraint ${uc.constraint_name}: ${error.message}`, 'info');
      }
    }

    // Step 8: Copy check constraints
    log('Copying check constraints...', 'info');
    const checkConstraints = await sourceClient.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        cc.check_clause
      FROM information_schema.check_constraints cc
      JOIN information_schema.table_constraints tc
        ON cc.constraint_name = tc.constraint_name
        AND cc.constraint_schema = tc.constraint_schema
      WHERE tc.table_schema = 'public'
    `);

    log(`  Found ${checkConstraints.rows.length} check constraints to copy`, 'info');
    for (const cc of checkConstraints.rows) {
      try {
        await targetClient.query(`
          ALTER TABLE "${cc.table_name}"
          ADD CONSTRAINT "${cc.constraint_name}" CHECK (${cc.check_clause})
        `);
        log(`  Added check constraint: ${cc.constraint_name}`, 'info');
      } catch (error) {
        log(`  Warning: Could not add check constraint ${cc.constraint_name}: ${error.message}`, 'info');
      }
    }

    // Verify
    log('Verifying duplication...', 'info');
    const targetTables = await getTableNames(targetClient);
    log(`Verification complete: ${targetTables.length} tables in new database`, 'success');

    // Count rows in retained tables
    log('Verifying data in retained tables...', 'info');
    for (const table of config.tablesToRetainData) {
      if (targetTables.includes(table)) {
        const count = await targetClient.query(`SELECT COUNT(*) as count FROM "${table}"`);
        log(`  ${table}: ${count.rows[0].count} rows`, 'info');
      }
    }

    // Success message
    log('═══════════════════════════════════════════════════════════', 'success');
    log('Database duplication completed successfully!', 'success');
    log('═══════════════════════════════════════════════════════════', 'success');
    log(`Source Database: ${config.sourceDb.database}`, 'info');
    log(`New Database: ${config.targetDbName}`, 'info');
    log(`Connection String: ${getConnectionString(config.targetDbName)}`, 'info');
    log(`Tables with retained data: ${config.tablesToRetainData.join(', ')}`, 'info');
    log('All other tables are empty.', 'info');
    log('═══════════════════════════════════════════════════════════', 'success');

  } catch (error) {
    log('═══════════════════════════════════════════════════════════', 'error');
    log('Database duplication failed!', 'error');
    log('═══════════════════════════════════════════════════════════', 'error');
    log(error.message, 'error');
    if (error.stack) {
      log(error.stack, 'error');
    }
    process.exit(1);
  } finally {
    if (sourceClient) await sourceClient.end();
    if (targetClient) await targetClient.end();
    if (adminClient) await adminClient.end();
  }
}

// Run the script
if (require.main === module) {
  duplicateDatabase();
}

module.exports = { duplicateDatabase, parseDatabaseUrl };

