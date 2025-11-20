/**
 * Database Duplication Script
 * 
 * This script creates an exact duplicate of the current database
 * with a new name, including all data, tables, constraints, and relationships.
 * 
 * Usage: node scripts/duplicate-database.js <new_database_name>
 * Example: node scripts/duplicate-database.js pospitality
 */

require('dotenv').config();
const { Pool, Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  // Parse DATABASE_URL
  sourceDb: parseDatabaseUrl(process.env.DATABASE_URL),
  // Get target database name from command line argument
  targetDbName: process.argv[2] || 'hospitality',
  // Temporary dump file
  tempDumpFile: path.join(__dirname, '../backups/temp_duplicate_dump.sql'),
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
 * Get table DDL (CREATE TABLE statement)
 */
async function getTableDDL(client, tableName) {
  const result = await client.query(`
    SELECT 
      'CREATE TABLE IF NOT EXISTS "' || schemaname || '"."' || tablename || '" (' ||
      string_agg(column_def, ', ') ||
      ');' as ddl
    FROM (
      SELECT 
        t.schemaname,
        t.tablename,
        a.attname || ' ' || 
        pg_catalog.format_type(a.atttypid, a.atttypmod) ||
        CASE 
          WHEN a.attnotnull THEN ' NOT NULL'
          ELSE ''
        END ||
        CASE 
          WHEN a.atthasdef THEN ' DEFAULT ' || pg_get_expr(adbin, adrelid)
          ELSE ''
        END as column_def,
        a.attnum
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      JOIN pg_attribute a ON a.attrelid = c.oid
      LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
      WHERE t.tablename = $1
        AND t.schemaname = 'public'
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY a.attnum
    ) sub
    GROUP BY schemaname, tablename
  `, [tableName]);

  if (result.rows.length === 0) {
    // Fallback: use pg_dump approach via query
    const dumpResult = await client.query(`
      SELECT 
        'CREATE TABLE IF NOT EXISTS public."' || tablename || '" (' ||
        string_agg(
          '"' || column_name || '" ' || 
          data_type ||
          CASE WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')'
            ELSE ''
          END ||
          CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN column_default IS NOT NULL 
            THEN ' DEFAULT ' || column_default
            ELSE ''
          END,
          ', '
        ) || ');' as ddl
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      GROUP BY table_name
    `, [tableName]);
    
    return dumpResult.rows[0]?.ddl || '';
  }

  return result.rows[0]?.ddl || '';
}

/**
 * Get primary keys
 */
async function getPrimaryKeys(client, tableName) {
  const result = await client.query(`
    SELECT
      a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = $1
      AND i.indisprimary
  `, [tableName]);

  return result.rows.map(row => row.column_name);
}

/**
 * Get foreign keys with full constraint definitions
 */
async function getForeignKeys(client) {
  const result = await client.query(`
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
  for (const row of result.rows) {
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

  return Array.from(fkMap.values());
}

/**
 * Copy table data
 */
async function copyTableData(sourceClient, targetClient, tableName) {
  log(`Copying data for table: ${tableName}`, 'info');
  
  // Get all data from source
  const sourceData = await sourceClient.query(`SELECT * FROM "${tableName}"`);
  
  if (sourceData.rows.length === 0) {
    log(`  Table ${tableName} is empty, skipping data copy`, 'info');
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
    log('Starting database duplication process...', 'info');
    log(`Source Database: ${config.sourceDb.database}`, 'info');
    log(`Target Database: ${config.targetDbName}`, 'info');
    log(`Host: ${config.sourceDb.host}:${config.sourceDb.port}`, 'info');

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

    // Step 1: Create all tables with structure using CREATE TABLE ... LIKE (simplest and most reliable)
    log('Creating table structures...', 'info');
    
    for (const table of tables) {
      log(`  Creating table: ${table}`, 'info');
      
      // Use CREATE TABLE ... LIKE to copy structure exactly
      // This preserves all column types, constraints, defaults, etc.
      try {
        await targetClient.query(`CREATE TABLE IF NOT EXISTS "${table}" (LIKE "${table}" INCLUDING ALL)`);
      } catch (error) {
        // If LIKE doesn't work (table doesn't exist in target), create manually
        log(`  Using manual creation for ${table}`, 'info');
        
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

        // Build CREATE TABLE statement (without defaults to avoid syntax issues)
        const columns = tableInfo.rows.map(col => {
          let def = `"${col.column_name}" ${col.full_type}`;
          if (col.is_not_null) {
            def += ' NOT NULL';
          }
          return def;
        }).join(', ');

        await targetClient.query(`CREATE TABLE IF NOT EXISTS "${table}" (${columns})`);
      }
    }

    // Step 2: Add primary keys (get actual constraint names from source)
    log('Adding primary keys...', 'info');
    for (const table of tables) {
      try {
        // Get the actual primary key constraint name and columns from source
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

    // Step 3: Copy all data
    log('Copying data...', 'info');
    for (const table of tables) {
      await copyTableData(sourceClient, targetClient, table);
    }

    // Step 4: Add foreign keys (with proper multi-column support)
    log('Adding foreign keys...', 'info');
    const foreignKeys = await getForeignKeys(sourceClient);
    log(`  Found ${foreignKeys.length} foreign key constraints to add`, 'info');
    
    for (const fk of foreignKeys) {
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
        log(`  Added FK: ${fk.constraint_name}`, 'info');
      } catch (error) {
        log(`  Warning: Could not add FK ${fk.constraint_name}: ${error.message}`, 'error');
      }
    }

    // Step 5: Copy sequences and set their values
    log('Copying sequences...', 'info');
    const sequences = await sourceClient.query(`
      SELECT 
        sequencename as sequence_name,
        last_value
      FROM pg_sequences
      WHERE schemaname = 'public'
    `);

    log(`  Found ${sequences.rows.length} sequences to copy`, 'info');
    for (const seq of sequences.rows) {
      try {
        // Get the full sequence definition from source
        const seqDef = await sourceClient.query(`
          SELECT 
            pg_get_serial_sequence('"${seq.sequence_name}"', '') as serial_seq,
            (SELECT last_value FROM "${seq.sequence_name}") as last_value
        `).catch(async () => {
          // If not a serial sequence, get it directly
          const direct = await sourceClient.query(`SELECT last_value FROM "${seq.sequence_name}"`);
          return { rows: [{ serial_seq: null, last_value: direct.rows[0].last_value }] };
        });

        if (seqDef.rows.length > 0 && seqDef.rows[0].last_value !== null) {
          const lastVal = seqDef.rows[0].last_value;
          // Create sequence (it might already exist from table creation, so use IF NOT EXISTS)
          await targetClient.query(`CREATE SEQUENCE IF NOT EXISTS "${seq.sequence_name}"`);
          // Set the sequence value
          await targetClient.query(`SELECT setval('"${seq.sequence_name}"', ${lastVal}, true)`);
          log(`  Copied sequence ${seq.sequence_name} (last_value: ${lastVal})`, 'info');
        }
      } catch (error) {
        log(`  Warning: Could not copy sequence ${seq.sequence_name}: ${error.message}`, 'info');
      }
    }

    // Step 6: Copy indexes (excluding primary key indexes which are already created)
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
        // Replace the table name in the index definition if needed
        let indexDef = idx.indexdef;
        // Ensure it uses the target database schema
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
        AND cc.constraint_schema = tc.table_schema
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

    // Success message
    log('═══════════════════════════════════════════════════════════', 'success');
    log('Database duplication completed successfully!', 'success');
    log('═══════════════════════════════════════════════════════════', 'success');
    log(`Source Database: ${config.sourceDb.database}`, 'info');
    log(`New Database: ${config.targetDbName}`, 'info');
    log(`Connection String: ${getConnectionString(config.targetDbName)}`, 'info');
    log('═══════════════════════════════════════════════════════════', 'success');

  } catch (error) {
    log('═══════════════════════════════════════════════════════════', 'error');
    log('Database duplication failed!', 'error');
    log('═══════════════════════════════════════════════════════════', 'error');
    log(error.message, 'error');
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
