/**
 * Fix Hospital Database - Create missing tables and copy data
 * 
 * This script:
 * 1. Gets exact CREATE TABLE statements from source database
 * 2. Creates missing tables in hospital database
 * 3. Copies data from tblUsers and tblEmployees
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
  // Get the actual CREATE TABLE statement using pg_get_tabledef or by querying system catalogs
  try {
    // Try to get DDL using a function that might exist
    const result = await client.query(`
      SELECT 
        'CREATE TABLE "' || schemaname || '"."' || tablename || '" (' ||
        string_agg(
          '"' || attname || '" ' ||
          pg_catalog.format_type(atttypid, atttypmod) ||
          CASE WHEN attnotnull THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN atthasdef THEN ' DEFAULT ' || pg_get_expr(adbin, adrelid) ELSE '' END,
          ', '
          ORDER BY attnum
        ) || ');' as ddl
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
      WHERE n.nspname = 'public'
        AND c.relname = $1
        AND a.attnum > 0
        AND NOT a.attisdropped
      GROUP BY schemaname, tablename
    `, [tableName]);
    
    if (result.rows[0]?.ddl) {
      return result.rows[0].ddl;
    }
  } catch (err) {
    // Fallback method
  }
  
  // Fallback: Use information_schema with better type handling
  const colsResult = await client.query(`
    SELECT 
      column_name,
      data_type,
      udt_name,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      is_nullable,
      column_default,
      CASE 
        WHEN data_type = 'ARRAY' THEN true
        ELSE false
      END as is_array
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);

  if (colsResult.rows.length === 0) {
    return null;
  }

  const columns = colsResult.rows.map(col => {
    let colDef = `"${col.column_name}"`;
    
    // Handle data type
    let dataType = col.udt_name;
    
    // Check if it's an array
    if (col.is_array || col.udt_name.endsWith('_array')) {
      const baseType = col.udt_name.replace(/_array$/, '');
      // Map base type
      const typeMap = {
        'int4': 'integer',
        'int8': 'bigint',
        'varchar': 'character varying',
        'text': 'text'
      };
      const mappedType = typeMap[baseType] || baseType;
      dataType = `${mappedType}[]`;
    } else if (col.character_maximum_length) {
      dataType = `${col.data_type}(${col.character_maximum_length})`;
    } else if (col.numeric_precision !== null) {
      if (col.numeric_scale !== null && col.numeric_scale > 0) {
        dataType = `${col.data_type}(${col.numeric_precision},${col.numeric_scale})`;
      } else {
        dataType = `${col.data_type}(${col.numeric_precision})`;
      }
    } else {
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

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns});`;
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

    // Tables that need to be created
    const tablesToFix = ['tblUsers', 'tblEmployees'];
    
    for (const tableName of tablesToFix) {
      console.log(`📋 Creating ${tableName}...`);
      
      // Check if table exists
      const exists = await hospitalClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [tableName]);
      
      if (exists.rows[0].exists) {
        console.log(`  ✅ ${tableName} already exists`);
        continue;
      }
      
      // Get DDL from source
      const ddl = await getTableDDL(sourceClient, tableName);
      
      if (!ddl) {
        console.log(`  ❌ Could not get DDL for ${tableName}`);
        continue;
      }
      
      try {
        await hospitalClient.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
        await hospitalClient.query(ddl);
        console.log(`  ✅ ${tableName} created`);
      } catch (err) {
        console.error(`  ❌ Error creating ${tableName}:`, err.message);
        // Try to get the actual CREATE statement from PostgreSQL
        try {
          // Use a simpler approach - copy structure using CREATE TABLE AS
          // But we need to do it across databases, so let's try getting the exact SQL
          const exactDDL = await sourceClient.query(`
            SELECT 
              'CREATE TABLE "' || $1 || '" (' ||
              string_agg(
                '"' || a.attname || '" ' ||
                pg_catalog.format_type(a.atttypid, a.atttypmod) ||
                CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
                ', '
                ORDER BY a.attnum
              ) || ');' as create_stmt
            FROM pg_attribute a
            JOIN pg_class c ON a.attrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            WHERE n.nspname = 'public'
              AND c.relname = $1
              AND a.attnum > 0
              AND NOT a.attisdropped
          `, [tableName]);
          
          if (exactDDL.rows[0]?.create_stmt) {
            await hospitalClient.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
            await hospitalClient.query(exactDDL.rows[0].create_stmt);
            console.log(`  ✅ ${tableName} created (using exact DDL)`);
          }
        } catch (err2) {
          console.error(`  ❌ Failed to create ${tableName}:`, err2.message);
        }
      }
    }

    // Now copy data
    console.log('\n📋 Copying data...');
    
    for (const tableName of tablesToFix) {
      console.log(`  Copying ${tableName}...`);
      
      // Check if table exists
      const exists = await hospitalClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [tableName]);
      
      if (!exists.rows[0].exists) {
        console.log(`    ⚠️  Table ${tableName} does not exist, skipping data copy`);
        continue;
      }
      
      // Get data from source
      const dataResult = await sourceClient.query(`SELECT * FROM "${tableName}"`);
      
      if (dataResult.rows.length === 0) {
        console.log(`    ℹ️  ${tableName} is empty in source`);
        continue;
      }
      
      const columns = Object.keys(dataResult.rows[0]);
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
          await hospitalClient.query(query, allValues);
          insertedCount += batch.length;
        } catch (err) {
          console.error(`    ❌ Error inserting batch:`, err.message);
        }
      }
      
      console.log(`    ✅ Copied ${insertedCount} rows from ${tableName}`);
    }

    console.log('\n✅ Done!');

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

