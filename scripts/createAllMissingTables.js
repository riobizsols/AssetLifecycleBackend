/**
 * Create All Missing Tables in Hospital Database
 * 
 * Compares source database with hospital database and creates all missing tables
 */

const { Client } = require('pg');
require('dotenv').config();

const sourceDbUrl = process.env.DATABASE_URL;

if (!sourceDbUrl) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

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

async function getTableDDL(client, tableName) {
  // Get exact DDL using pg_catalog
  try {
    const result = await client.query(`
      SELECT 
        'CREATE TABLE IF NOT EXISTS "' || $1 || '" (' ||
        string_agg(
          '"' || a.attname || '" ' ||
          pg_catalog.format_type(a.atttypid, a.atttypmod) ||
          CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
          CASE 
            WHEN atthasdef THEN 
              ' DEFAULT ' || pg_get_expr(adbin, adrelid)
            ELSE ''
          END,
          ', '
          ORDER BY a.attnum
        ) || ');' as create_stmt
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
      WHERE n.nspname = 'public'
        AND c.relname = $1
        AND a.attnum > 0
        AND NOT a.attisdropped
    `, [tableName]);
    
    if (result.rows[0]?.create_stmt) {
      return result.rows[0].create_stmt;
    }
  } catch (err) {
    console.error(`  ⚠️  Error getting DDL for ${tableName}:`, err.message);
  }
  return null;
}

async function main() {
  const sourceConfig = parseDatabaseUrl(sourceDbUrl);
  
  const sourceClient = new Client({
    host: sourceConfig.host,
    port: sourceConfig.port,
    user: sourceConfig.user,
    password: sourceConfig.password,
    database: sourceConfig.database,
  });

  const hospitalClient = new Client({
    host: sourceConfig.host,
    port: sourceConfig.port,
    user: sourceConfig.user,
    password: sourceConfig.password,
    database: 'hospital',
  });

  try {
    console.log('🔌 Connecting to databases...');
    await sourceClient.connect();
    await hospitalClient.connect();
    console.log('✅ Connected successfully\n');

    // Get all tables from source
    console.log('📋 Getting all tables from source database...');
    const sourceTablesResult = await sourceClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const sourceTables = sourceTablesResult.rows.map(r => r.table_name);
    console.log(`✅ Found ${sourceTables.length} tables in source database\n`);

    // Get all tables from hospital database
    console.log('📋 Getting all tables from hospital database...');
    const hospitalTablesResult = await hospitalClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const hospitalTables = hospitalTablesResult.rows.map(r => r.table_name);
    console.log(`✅ Found ${hospitalTables.length} tables in hospital database\n`);

    // Find missing tables
    const missingTables = sourceTables.filter(t => !hospitalTables.includes(t));
    
    console.log(`📊 Missing tables: ${missingTables.length}\n`);
    
    if (missingTables.length === 0) {
      console.log('✅ All tables exist in hospital database!');
      return;
    }

    // Create missing tables
    console.log('📋 Creating missing tables...\n');
    let successCount = 0;
    let failCount = 0;

    for (const tableName of missingTables) {
      console.log(`  Creating: ${tableName}`);
      
      try {
        const ddl = await getTableDDL(sourceClient, tableName);
        
        if (!ddl) {
          console.log(`    ❌ Could not get DDL for ${tableName}`);
          failCount++;
          continue;
        }
        
        await hospitalClient.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
        await hospitalClient.query(ddl);
        console.log(`    ✅ ${tableName} created`);
        successCount++;
        
        // Try to add primary key if it exists in source
        try {
          const pkResult = await sourceClient.query(`
            SELECT 
              string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu 
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = $1
            GROUP BY tc.table_name
          `, [tableName]);
          
          if (pkResult.rows.length > 0) {
            const columns = pkResult.rows[0].columns.split(', ').map(c => `"${c}"`).join(', ');
            await hospitalClient.query(`
              ALTER TABLE "${tableName}" 
              ADD CONSTRAINT "pk_${tableName}" 
              PRIMARY KEY (${columns})
            `);
            console.log(`    ✅ Primary key added`);
          }
        } catch (pkErr) {
          // Ignore PK errors
        }
        
      } catch (err) {
        console.error(`    ❌ Error creating ${tableName}:`, err.message);
        failCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Tables created: ${successCount}`);
    console.log(`   - Tables failed: ${failCount}`);
    console.log(`   - Total missing: ${missingTables.length}`);

    // Final count
    const finalCount = await hospitalClient.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    `);
    
    console.log(`\n✅ Hospital database now has ${finalCount.rows[0].count} tables`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await sourceClient.end();
    await hospitalClient.end();
  }
}

main()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

