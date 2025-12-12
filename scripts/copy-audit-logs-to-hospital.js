#!/usr/bin/env node

/**
 * Copy Audit Logs Data Script
 * 
 * This script copies data from tblAuditLogConfig and tblAuditLogs
 * from the generic database to the hospital database.
 * 
 * Usage:
 *   node scripts/copy-audit-logs-to-hospital.js <generic-db-name> <hospital-db-name>
 * 
 * Example:
 *   node scripts/copy-audit-logs-to-hospital.js assetlifecycle hospital_db
 */

const { Client } = require('pg');
require('dotenv').config();

/**
 * Parse PostgreSQL connection URL
 */
function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  // Parse postgresql://user:password@host:port/database
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

/**
 * Create database client connection
 */
function createDbClient(config, databaseName) {
  return new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: databaseName,
  });
}

/**
 * Copy data from source table to destination table
 */
async function copyTableData(sourceClient, destClient, tableName, columns) {
  console.log(`\n📋 Copying data from ${tableName}...`);
  
  try {
    // Read all data from source table
    const selectQuery = `SELECT ${columns.join(', ')} FROM "${tableName}"`;
    console.log(`   Reading from source: ${selectQuery}`);
    
    const sourceResult = await sourceClient.query(selectQuery);
    const rows = sourceResult.rows;
    
    console.log(`   Found ${rows.length} rows in source table`);
    
    if (rows.length === 0) {
      console.log(`   ⚠️  No data to copy from ${tableName}`);
      return { copied: 0, skipped: 0, errors: 0 };
    }
    
    // Check existing data in destination
    const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const destCountResult = await destClient.query(countQuery);
    const existingCount = parseInt(destCountResult.rows[0].count);
    console.log(`   Found ${existingCount} existing rows in destination table`);
    
    let copied = 0;
    let skipped = 0;
    let errors = 0;
    
    // Determine primary key column for conflict resolution
    let primaryKeyColumn = null;
    if (tableName === 'tblAuditLogConfig') {
      primaryKeyColumn = 'alc_id';
    } else if (tableName === 'tblAuditLogs') {
      primaryKeyColumn = 'al_id';
    }
    
    console.log(`   Inserting data into destination...`);
    
    // Use batch insertion for better performance
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      try {
        // Build batch insert query
        const valuesList = [];
        const allValues = [];
        let paramIndex = 1;
        
        for (const row of batch) {
          const rowPlaceholders = columns.map(() => `$${paramIndex++}`).join(', ');
          valuesList.push(`(${rowPlaceholders})`);
          columns.forEach(col => allValues.push(row[col]));
        }
        
        let insertQuery = `
          INSERT INTO "${tableName}" (${columns.join(', ')})
          VALUES ${valuesList.join(', ')}
        `;
        
        // Add conflict resolution if primary key is known
        if (primaryKeyColumn && columns.includes(primaryKeyColumn)) {
          insertQuery += ` ON CONFLICT (${primaryKeyColumn}) DO NOTHING`;
        }
        
        const result = await destClient.query(insertQuery, allValues);
        copied += result.rowCount;
        skipped += (batch.length - result.rowCount);
        
        if ((i + batchSize) % 500 === 0 || i + batchSize >= rows.length) {
          console.log(`   Progress: ${Math.min(i + batchSize, rows.length)}/${rows.length} rows processed`);
        }
      } catch (error) {
        console.error(`   ❌ Error inserting batch (rows ${i} to ${i + batch.length - 1}):`, error.message);
        // Fall back to individual inserts for this batch
        for (const row of batch) {
          try {
            const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
            let insertQuery = `
              INSERT INTO "${tableName}" (${columns.join(', ')})
              VALUES (${placeholders})
            `;
            
            if (primaryKeyColumn && columns.includes(primaryKeyColumn)) {
              insertQuery += ` ON CONFLICT (${primaryKeyColumn}) DO NOTHING`;
            }
            
            const values = columns.map(col => row[col]);
            const result = await destClient.query(insertQuery, values);
            
            if (result.rowCount > 0) {
              copied++;
            } else {
              skipped++;
            }
          } catch (rowError) {
            console.error(`   ❌ Error inserting individual row:`, rowError.message);
            errors++;
          }
        }
      }
    }
    
    console.log(`   ✅ Completed: ${copied} copied, ${skipped} skipped, ${errors} errors`);
    
    return { copied, skipped, errors };
    
  } catch (error) {
    console.error(`   ❌ Error copying ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Usage: node scripts/copy-audit-logs-to-hospital.js <generic-db-name> <hospital-db-name>');
    console.error('   Example: node scripts/copy-audit-logs-to-hospital.js assetlifecycle hospital_db');
    process.exit(1);
  }
  
  const genericDbName = args[0];
  const hospitalDbName = args[1];
  
  console.log('🚀 Starting Audit Logs Data Copy');
  console.log('─'.repeat(60));
  console.log(`📦 Source Database: ${genericDbName}`);
  console.log(`🏥 Destination Database: ${hospitalDbName}`);
  console.log('─'.repeat(60));
  
  // Parse database URL from environment
  const sourceDbUrl = process.env.DATABASE_URL;
  if (!sourceDbUrl) {
    console.error('❌ DATABASE_URL not found in .env file');
    process.exit(1);
  }
  
  const dbConfig = parseDatabaseUrl(sourceDbUrl);
  
  // Create database clients
  const genericClient = createDbClient(dbConfig, genericDbName);
  const hospitalClient = createDbClient(dbConfig, hospitalDbName);
  
  try {
    // Connect to databases
    console.log('\n🔌 Connecting to databases...');
    await genericClient.connect();
    console.log(`   ✅ Connected to ${genericDbName}`);
    
    await hospitalClient.connect();
    console.log(`   ✅ Connected to ${hospitalDbName}`);
    
    // Verify tables exist in both databases
    console.log('\n🔍 Verifying tables exist...');
    
    const checkTable = async (client, dbName, tableName) => {
      const checkQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `;
      const result = await client.query(checkQuery, [tableName]);
      return result.rows[0].exists;
    };
    
    const tables = ['tblAuditLogConfig', 'tblAuditLogs'];
    
    for (const table of tables) {
      const existsInGeneric = await checkTable(genericClient, genericDbName, table);
      const existsInHospital = await checkTable(hospitalClient, hospitalDbName, table);
      
      if (!existsInGeneric) {
        throw new Error(`Table ${table} does not exist in ${genericDbName}`);
      }
      if (!existsInHospital) {
        throw new Error(`Table ${table} does not exist in ${hospitalDbName}`);
      }
      console.log(`   ✅ ${table} exists in both databases`);
    }
    
    // Copy tblAuditLogsConfig
    const configColumns = [
      'alc_id',
      'app_id',
      'event_id',
      'enabled',
      'reporting_required',
      'reporting_email',
      'description',
      'org_id'
    ];
    
    const configResult = await copyTableData(
      genericClient,
      hospitalClient,
      'tblAuditLogConfig',
      configColumns
    );
    
    // Copy tblAuditLogs
    const logsColumns = [
      'al_id',
      'user_id',
      'app_id',
      'event_id',
      'text',
      'created_on',
      'org_id'
    ];
    
    const logsResult = await copyTableData(
      genericClient,
      hospitalClient,
      'tblAuditLogs',
      logsColumns
    );
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 COPY SUMMARY');
    console.log('═'.repeat(60));
    console.log(`\n📋 tblAuditLogConfig:`);
    console.log(`   ✅ Copied: ${configResult.copied}`);
    console.log(`   ⏭️  Skipped: ${configResult.skipped}`);
    console.log(`   ❌ Errors: ${configResult.errors}`);
    
    console.log(`\n📋 tblAuditLogs:`);
    console.log(`   ✅ Copied: ${logsResult.copied}`);
    console.log(`   ⏭️  Skipped: ${logsResult.skipped}`);
    console.log(`   ❌ Errors: ${logsResult.errors}`);
    
    const totalCopied = configResult.copied + logsResult.copied;
    const totalSkipped = configResult.skipped + logsResult.skipped;
    const totalErrors = configResult.errors + logsResult.errors;
    
    console.log(`\n📈 Total:`);
    console.log(`   ✅ Copied: ${totalCopied}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log('═'.repeat(60));
    
    if (totalErrors > 0) {
      console.log('\n⚠️  Some errors occurred during the copy process. Please review the output above.');
    } else {
      console.log('\n✅ Data copy completed successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    // Close connections
    await genericClient.end();
    await hospitalClient.end();
    console.log('\n🔌 Database connections closed');
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

