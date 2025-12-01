/**
 * Clone Database for Hospital
 * 
 * This script:
 * 1. Creates a new database with hospital name
 * 2. Copies all table structures from source database
 * 3. Copies only tblUsers and tblEmployees data
 * 4. Leaves other tables empty
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

// Get hospital name from command line argument
const hospitalName = process.argv[2];

if (!hospitalName) {
  console.error('❌ Please provide hospital name as argument');
  console.log('Usage: node cloneDatabaseForHospital.js <hospital-name>');
  console.log('Example: node cloneDatabaseForHospital.js "apollo-hospital"');
  process.exit(1);
}

// Generate new database name (sanitize hospital name)
const sanitizeDbName = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

const newDbName = sanitizeDbName(hospitalName);

async function main() {
  const sourceConfig = parseDatabaseUrl(sourceDbUrl);
  
  // Connect to postgres database to create new database
  const adminClient = new Client({
    host: sourceConfig.host,
    port: sourceConfig.port,
    user: sourceConfig.user,
    password: sourceConfig.password,
    database: 'postgres', // Connect to postgres database to create new DB
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

    // Step 1: Check if database already exists
    console.log(`\n📋 Checking if database '${newDbName}' exists...`);
    const dbCheckResult = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [newDbName]
    );

    if (dbCheckResult.rows.length > 0) {
      console.log(`⚠️  Database '${newDbName}' already exists!`);
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise(resolve => {
        readline.question('Do you want to drop and recreate it? (yes/no): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() === 'yes') {
        console.log(`🗑️  Dropping existing database '${newDbName}'...`);
        // Terminate all connections to the database
        await adminClient.query(`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1 AND pid <> pg_backend_pid()
        `, [newDbName]);
        
        await adminClient.query(`DROP DATABASE IF EXISTS "${newDbName}"`);
        console.log('✅ Database dropped');
      } else {
        console.log('❌ Operation cancelled');
        process.exit(0);
      }
    }

    // Step 2: Create new database
    console.log(`\n📦 Creating new database '${newDbName}'...`);
    await adminClient.query(`CREATE DATABASE "${newDbName}"`);
    console.log('✅ Database created');

    // Step 3: Connect to new database
    const newDbClient = new Client({
      host: sourceConfig.host,
      port: sourceConfig.port,
      user: sourceConfig.user,
      password: sourceConfig.password,
      database: newDbName,
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

    // Step 5: Copy table structures
    console.log('\n📋 Copying table structures...');
    
    for (const tableName of allTables) {
      console.log(`  Creating structure for: ${tableName}`);
      
      try {
        // Get table structure from source database
        const structureQuery = await sourceClient.query(`
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

        if (structureQuery.rows.length > 0) {
          const columns = structureQuery.rows.map(col => {
            let colDef = `"${col.column_name}"`;
            
            // Determine the correct data type
            let dataType = col.udt_name;
            
            // Handle length/precision for specific types
            if (col.character_maximum_length) {
              dataType = `${col.data_type}(${col.character_maximum_length})`;
            } else if (col.numeric_precision !== null) {
              if (col.numeric_scale !== null && col.numeric_scale > 0) {
                dataType = `${col.data_type}(${col.numeric_precision},${col.numeric_scale})`;
              } else {
                dataType = `${col.data_type}(${col.numeric_precision})`;
              }
            } else {
              // Map common udt_name to data_type
              const typeMap = {
                'int4': 'integer',
                'int8': 'bigint',
                'varchar': 'character varying',
                'text': 'text',
                'bool': 'boolean',
                'timestamp': 'timestamp without time zone',
                'date': 'date',
                'numeric': 'numeric',
                'uuid': 'uuid'
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

          // Drop if exists and create fresh
          await newDbClient.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
          await newDbClient.query(`CREATE TABLE "${tableName}" (${columns})`);
          console.log(`    ✅ ${tableName} structure created`);
        }
      } catch (err) {
        console.error(`    ❌ Error creating ${tableName}:`, err.message);
      }
    }

    // Step 6: Copy constraints, indexes, sequences, etc.
    console.log('\n📋 Copying constraints and indexes...');
    
    // Copy primary keys
    const pkResult = await sourceClient.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.ordinal_position
    `);

    const pkByTable = {};
    pkResult.rows.forEach(row => {
      if (!pkByTable[row.table_name]) {
        pkByTable[row.table_name] = [];
      }
      pkByTable[row.table_name].push(row.column_name);
    });

    for (const [tableName, columns] of Object.entries(pkByTable)) {
      try {
        const constraintName = `pk_${tableName}`;
        await newDbClient.query(`
          ALTER TABLE "${tableName}" 
          ADD CONSTRAINT "${constraintName}" 
          PRIMARY KEY (${columns.map(c => `"${c}"`).join(', ')})
        `);
        console.log(`    ✅ Primary key for ${tableName}`);
      } catch (err) {
        // Ignore if already exists
        if (!err.message.includes('already exists')) {
          console.error(`    ⚠️  Error adding PK to ${tableName}:`, err.message);
        }
      }
    }

    // Step 7: Copy data from tblUsers and tblEmployees only
    console.log('\n📋 Copying data from tblUsers and tblEmployees...');
    
    const tablesToCopy = ['tblUsers', 'tblEmployees'];
    
    for (const tableName of tablesToCopy) {
      if (!allTables.includes(tableName)) {
        console.log(`    ⚠️  Table ${tableName} not found, skipping...`);
        continue;
      }

      console.log(`  Copying data from ${tableName}...`);
      
      // Get row count
      const countResult = await sourceClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const rowCount = parseInt(countResult.rows[0].count);
      
      if (rowCount === 0) {
        console.log(`    ℹ️  ${tableName} is empty, skipping...`);
        continue;
      }

      // Get all data
      const dataResult = await sourceClient.query(`SELECT * FROM "${tableName}"`);
      
      if (dataResult.rows.length > 0) {
        // Get column names
        const columns = Object.keys(dataResult.rows[0]);
        
        // Insert data in batches
        const batchSize = 100;
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
            await newDbClient.query(query, allValues);
            console.log(`    ✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${Math.min(batch.length, rowCount - i)} rows)`);
          } catch (err) {
            console.error(`    ❌ Error inserting batch:`, err.message);
          }
        }
        
        console.log(`    ✅ Copied ${rowCount} rows from ${tableName}`);
      }
    }

    // Step 8: Reset sequences
    console.log('\n📋 Resetting sequences...');
    const sequencesResult = await newDbClient.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);

    for (const seq of sequencesResult.rows) {
      try {
        // Get max value from related table if possible
        const tableName = seq.sequence_name.replace(/_id_seq$/, '').replace(/_seq$/, '');
        const maxResult = await newDbClient.query(`
          SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(column_name, '[^0-9]', '', 'g') AS INTEGER)), 0) as max_val
          FROM (
            SELECT unnest(string_to_array(pg_get_serial_sequence('"${tableName}"', '${tableName}_id'), '.')) as column_name
          ) sub
        `).catch(() => ({ rows: [{ max_val: 0 }] }));

        // Simple approach: just reset to 1
        await newDbClient.query(`SELECT setval('"${seq.sequence_name}"', 1, false)`);
        console.log(`    ✅ Reset sequence ${seq.sequence_name}`);
      } catch (err) {
        console.error(`    ⚠️  Error resetting sequence ${seq.sequence_name}:`, err.message);
      }
    }

    console.log('\n✅ Database clone completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - New database: ${newDbName}`);
    console.log(`   - Tables created: ${allTables.length}`);
    console.log(`   - Data copied from: tblUsers, tblEmployees`);
    console.log(`   - Other tables: Empty (structure only)`);
    
    console.log(`\n🔗 New database URL:`);
    const newDbUrl = `postgresql://${sourceConfig.user}:${sourceConfig.password}@${sourceConfig.host}:${sourceConfig.port}/${newDbName}`;
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

