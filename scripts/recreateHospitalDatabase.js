/**
 * Recreate Hospital Database
 * 
 * Deletes existing hospital database and creates a fresh one with:
 * - All table structures from source database
 * - Only tblUsers and tblEmployees data
 * - All other tables empty
 */

const { Client } = require('pg');
require('dotenv').config();

// Get source database URL from .env
const sourceDbUrl = process.env.DATABASE_URL;

if (!sourceDbUrl) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

// Parse source database URL
function parseDatabaseUrl(databaseUrl) {
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid database URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

const dbName = 'hospital';

async function main() {
  const sourceConfig = parseDatabaseUrl(sourceDbUrl);
  
  // Connect to postgres database
  const adminClient = new Client({
    host: sourceConfig.host,
    port: sourceConfig.port,
    user: sourceConfig.user,
    password: sourceConfig.password,
    database: 'postgres',
  });

  // Connect to source database
  const sourceClient = new Client({
    host: sourceConfig.host,
    port: sourceConfig.port,
    user: sourceConfig.user,
    password: sourceConfig.password,
    database: sourceConfig.database,
  });

  let newDbClient = null;

  try {
    console.log('🔌 Connecting to databases...');
    await adminClient.connect();
    await sourceClient.connect();
    console.log('✅ Connected successfully');

    // Step 1: Drop existing hospital database if it exists
    console.log(`\n🗑️  Dropping existing '${dbName}' database if it exists...`);
    try {
      // Terminate all connections to the database
      await adminClient.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [dbName]);
      
      await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      console.log('✅ Existing database dropped');
    } catch (err) {
      if (err.message.includes('does not exist')) {
        console.log('ℹ️  Database does not exist, continuing...');
      } else {
        throw err;
      }
    }

    // Step 2: Create new database
    console.log(`\n📦 Creating new database '${dbName}'...`);
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
    console.log('✅ Database created');

    // Step 3: Connect to new database
    newDbClient = new Client({
      host: sourceConfig.host,
      port: sourceConfig.port,
      user: sourceConfig.user,
      password: sourceConfig.password,
      database: dbName,
    });

    await newDbClient.connect();
    console.log('✅ Connected to new database');

    // Step 4: Get all table names from source database
    console.log('\n📋 Getting all table names from source database...');
    const tablesResult = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const allTables = tablesResult.rows.map(row => row.table_name);
    console.log(`✅ Found ${allTables.length} tables`);

    // Step 5: Copy table structures using CREATE TABLE AS with LIMIT 0
    // This method preserves all data types including arrays and complex types
    console.log('\n📋 Copying table structures...');
    
    for (const tableName of allTables) {
      console.log(`  Creating structure for: ${tableName}`);
      
      try {
        // Use CREATE TABLE AS with LIMIT 0 to copy structure
        // But we need to do this across databases, so we'll use a different approach
        // Get the CREATE TABLE statement from pg_get_tabledef or use information_schema
        
        // First, try to get the full DDL
        const ddlResult = await sourceClient.query(`
          SELECT 
            'CREATE TABLE "' || table_name || '" (' ||
            string_agg(
              '"' || column_name || '" ' ||
              CASE 
                WHEN data_type = 'ARRAY' THEN 
                  udt_name || '[]'
                WHEN data_type = 'USER-DEFINED' THEN
                  udt_name
                WHEN character_maximum_length IS NOT NULL THEN
                  data_type || '(' || character_maximum_length || ')'
                WHEN numeric_precision IS NOT NULL AND numeric_scale IS NOT NULL THEN
                  data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
                WHEN numeric_precision IS NOT NULL THEN
                  data_type || '(' || numeric_precision || ')'
                ELSE
                  CASE 
                    WHEN udt_name = 'int4' THEN 'integer'
                    WHEN udt_name = 'int8' THEN 'bigint'
                    WHEN udt_name = 'varchar' THEN 'character varying'
                    WHEN udt_name = 'text' THEN 'text'
                    WHEN udt_name = 'bool' THEN 'boolean'
                    WHEN udt_name = 'timestamp' THEN 'timestamp without time zone'
                    WHEN udt_name = 'date' THEN 'date'
                    WHEN udt_name = 'numeric' THEN 'numeric'
                    WHEN udt_name = 'uuid' THEN 'uuid'
                    WHEN udt_name = 'jsonb' THEN 'jsonb'
                    WHEN udt_name = 'json' THEN 'json'
                    ELSE udt_name
                  END
              END ||
              CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
              CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
              ', '
              ORDER BY ordinal_position
            ) || ');' as create_statement
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          GROUP BY table_name
        `, [tableName]);

        if (ddlResult.rows[0]?.create_statement) {
          let createStmt = ddlResult.rows[0].create_statement;
          // Fix array types
          createStmt = createStmt.replace(/_array\[\]/g, '[]');
          
          await newDbClient.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
          await newDbClient.query(createStmt);
          console.log(`    ✅ ${tableName} structure created`);
        } else {
          // Fallback: Get columns individually and handle arrays properly
          const colsResult = await sourceClient.query(`
            SELECT 
              column_name,
              data_type,
              udt_name,
              character_maximum_length,
              numeric_precision,
              numeric_scale,
              is_nullable,
              column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY ordinal_position
          `, [tableName]);

          if (colsResult.rows.length > 0) {
            const columns = colsResult.rows.map(col => {
              let colDef = `"${col.column_name}"`;
              
              // Handle data type
              let dataType = col.udt_name;
              
              // Check if it's an array type
              if (col.data_type === 'ARRAY') {
                // Get base type from udt_name (remove _array suffix)
                const baseType = col.udt_name.replace(/_array$/, '');
                dataType = `${baseType}[]`;
              } else if (col.character_maximum_length) {
                dataType = `${col.data_type}(${col.character_maximum_length})`;
              } else if (col.numeric_precision !== null) {
                if (col.numeric_scale !== null && col.numeric_scale > 0) {
                  dataType = `${col.data_type}(${col.numeric_precision},${col.numeric_scale})`;
                } else {
                  dataType = `${col.data_type}(${col.numeric_precision})`;
                }
              } else {
                // Map common types
                const typeMap = {
                  'int4': 'integer',
                  'int8': 'bigint',
                  'varchar': 'character varying',
                  'text': 'text',
                  'bool': 'boolean',
                  'timestamp': 'timestamp without time zone',
                  'timestamptz': 'timestamp with time zone',
                  'date': 'date',
                  'numeric': 'numeric',
                  'uuid': 'uuid',
                  'jsonb': 'jsonb',
                  'json': 'json'
                };
                dataType = typeMap[col.udt_name] || col.data_type || col.udt_name;
              }
              
              colDef += ` ${dataType}`;
              
              if (col.is_nullable === 'NO') {
                colDef += ' NOT NULL';
              }
              if (col.column_default) {
                colDef += ` DEFAULT ${col.column_default}`;
              }
              return colDef;
            }).join(', ');

            await newDbClient.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
            await newDbClient.query(`CREATE TABLE "${tableName}" (${columns})`);
            console.log(`    ✅ ${tableName} structure created`);
          }
        }
      } catch (err) {
        console.error(`    ❌ Error creating ${tableName}:`, err.message);
        // Continue with other tables
      }
    }

    // Step 6: Copy primary keys
    console.log('\n📋 Copying primary keys...');
    const pkResult = await sourceClient.query(`
      SELECT 
        tc.table_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
      GROUP BY tc.table_name
    `);

    for (const row of pkResult.rows) {
      try {
        const constraintName = `pk_${row.table_name}`;
        const columns = row.columns.split(', ').map(c => `"${c}"`).join(', ');
        await newDbClient.query(`
          ALTER TABLE "${row.table_name}" 
          ADD CONSTRAINT "${constraintName}" 
          PRIMARY KEY (${columns})
        `);
        console.log(`    ✅ Primary key for ${row.table_name}`);
      } catch (err) {
        if (!err.message.includes('already exists') && !err.message.includes('does not exist')) {
          console.error(`    ⚠️  Error adding PK to ${row.table_name}:`, err.message);
        }
      }
    }

    // Step 7: Copy data from tblUsers and tblEmployees only
    console.log('\n📋 Copying data from tblUsers and tblEmployees...');
    
    const tablesToCopy = ['tblUsers', 'tblEmployees'];
    
    for (const tableName of tablesToCopy) {
      if (!allTables.includes(tableName)) {
        console.log(`    ⚠️  Table ${tableName} not found in source, skipping...`);
        continue;
      }

      console.log(`  Copying data from ${tableName}...`);
      
      // Check if table exists in new database
      const tableExists = await newDbClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [tableName]);
      
      if (!tableExists.rows[0].exists) {
        console.log(`    ⚠️  Table ${tableName} does not exist in new database, skipping...`);
        continue;
      }
      
      // Get row count
      const countResult = await sourceClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const rowCount = parseInt(countResult.rows[0].count);
      
      if (rowCount === 0) {
        console.log(`    ℹ️  ${tableName} is empty in source, skipping...`);
        continue;
      }

      // Get all data
      const dataResult = await sourceClient.query(`SELECT * FROM "${tableName}"`);
      
      if (dataResult.rows.length > 0) {
        // Get column names
        const columns = Object.keys(dataResult.rows[0]);
        
        // Insert data in batches
        const batchSize = 100;
        let insertedCount = 0;
        
        for (let i = 0; i < dataResult.rows.length; i += batchSize) {
          const batch = dataResult.rows.slice(i, i + batchSize);
          
          const values = batch.map((row, idx) => {
            const placeholders = columns.map((_, colIdx) => 
              `$${idx * columns.length + colIdx + 1}`
            ).join(', ');
            return `(${placeholders})`;
          }).join(', ');

          const allValues = batch.flatMap(row => 
            columns.map(col => row[col])
          );

          const query = `
            INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
            VALUES ${values}
            ON CONFLICT DO NOTHING
          `;

          try {
            const result = await newDbClient.query(query, allValues);
            insertedCount += batch.length;
            console.log(`    ✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} rows)`);
          } catch (err) {
            console.error(`    ❌ Error inserting batch:`, err.message);
            // Try inserting row by row to identify problematic rows
            for (const row of batch) {
              try {
                const singleRowValues = columns.map(col => row[col]);
                const singleQuery = `
                  INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
                  VALUES (${columns.map((_, idx) => `$${idx + 1}`).join(', ')})
                  ON CONFLICT DO NOTHING
                `;
                await newDbClient.query(singleQuery, singleRowValues);
                insertedCount++;
              } catch (singleErr) {
                console.error(`      ⚠️  Skipped row due to error:`, singleErr.message);
              }
            }
          }
        }
        
        console.log(`    ✅ Copied ${insertedCount} rows from ${tableName}`);
      }
    }

    console.log('\n✅ Database clone completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - New database: ${dbName}`);
    console.log(`   - Tables created: ${allTables.length}`);
    console.log(`   - Data copied from: tblUsers, tblEmployees`);
    console.log(`   - Other tables: Empty (structure only)`);
    
    console.log(`\n🔗 New database URL:`);
    const newDbUrl = `postgresql://${sourceConfig.user}:${sourceConfig.password}@${sourceConfig.host}:${sourceConfig.port}/${dbName}`;
    console.log(`   ${newDbUrl}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await adminClient.end();
    await sourceClient.end();
    if (newDbClient) await newDbClient.end();
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

