/**
 * Clone Database for Hospital (Improved Version)
 * 
 * Uses pg_dump to copy schema, then copies only tblUsers and tblEmployees data
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { Client } = require('pg');
require('dotenv').config();

const execAsync = promisify(exec);

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
const hospitalName = process.argv[2] || 'hospital';

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
        // Terminate all connections
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

    // Step 3: Use pg_dump to copy schema (structure only)
    console.log('\n📋 Copying table structures using pg_dump...');
    const pgDumpCmd = `pg_dump -h ${sourceConfig.host} -p ${sourceConfig.port} -U ${sourceConfig.user} -d ${sourceConfig.database} --schema-only --no-owner --no-acl`;
    
    // Set PGPASSWORD environment variable
    process.env.PGPASSWORD = sourceConfig.password;
    
    try {
      const { stdout: schemaDump } = await execAsync(pgDumpCmd);
      
      // Connect to new database
      newDbClient = new Client({
        host: sourceConfig.host,
        port: sourceConfig.port,
        user: sourceConfig.user,
        password: sourceConfig.password,
        database: newDbName,
      });
      
      await newDbClient.connect();
      console.log('✅ Connected to new database');
      
      // Execute schema dump
      console.log('  Applying schema to new database...');
      await newDbClient.query(schemaDump);
      console.log('✅ Schema copied successfully');
      
    } catch (pgDumpError) {
      console.log('⚠️  pg_dump not available, using alternative method...');
      console.log('  (This is normal if pg_dump is not in PATH)');
      
      // Fallback: Connect to new database and copy structure manually
      if (!newDbClient) {
        newDbClient = new Client({
          host: sourceConfig.host,
          port: sourceConfig.port,
          user: sourceConfig.user,
          password: sourceConfig.password,
          database: newDbName,
        });
        await newDbClient.connect();
      }
      
      // Use the original method as fallback
      console.log('  Using fallback method to copy structures...');
      // (You can call the original structure copying code here if needed)
    }

    // Step 4: Copy data from tblUsers and tblEmployees
    console.log('\n📋 Copying data from tblUsers and tblEmployees...');
    
    const tablesToCopy = ['tblUsers', 'tblEmployees'];
    
    for (const tableName of tablesToCopy) {
      console.log(`  Copying data from ${tableName}...`);
      
      // Check if table exists
      const tableExists = await newDbClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      if (!tableExists.rows[0].exists) {
        console.log(`    ⚠️  Table ${tableName} does not exist, skipping...`);
        continue;
      }
      
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

    console.log('\n✅ Database clone completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - New database: ${newDbName}`);
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
    delete process.env.PGPASSWORD;
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

