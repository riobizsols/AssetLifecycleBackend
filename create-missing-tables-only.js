/**
 * Create ONLY missing tables in manufacturing database (no foreign keys)
 */

require('dotenv').config();
const { Pool } = require('pg');

// Missing tables from the check-tables output
const MISSING_TABLES = [
  'tblATMaintFreq',
  'tblAssetDepHist',
  'tblAssetPropListValues',
  'tblAssetTypes',
  'tblAssetUsageReg',
  'tblAssets',
  'tblBranches',
  'tblDepartments',
  'tblDepreciationSettings',
  'tblDeptAssetTypes',
  'tblEmployees',
  'tblIDSequences',
  'tblJobRoleNav',
  'tblJobRoles',
  'tblOrgs',
  'tblScrapSales_D',
  'tblStatusCodes',
  'tblTableFilterColumns',
  'tblTechnicalLogConfig',
  'tblUsers',
  'tblVendorSLAs',
  'tblVendors',
  'tblWFAssetMaintSch_D',
  'tblWFScrapSeq',
  'tblWFScrap_D',
  'tblvendorslarecs'
];

async function createMissingTables() {
  console.log('🚀 Creating missing tables in manufacturing database...');
  
  const sourcePool = new Pool({ connectionString: process.env.GENERIC_URL });
  const targetPool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log(`\n📋 Found ${MISSING_TABLES.length} missing tables to create\n`);
    
    for (const tableName of MISSING_TABLES) {
      try {
        console.log(`🔨 Creating ${tableName}...`);
        
        // Get CREATE TABLE statement from source database
        const result = await sourcePool.query(`
          SELECT 
            'CREATE TABLE IF NOT EXISTS "' || table_name || '" (' || 
            string_agg(
              '"' || column_name || '" ' || 
              CASE 
                WHEN data_type = 'character varying' THEN 
                  'VARCHAR' || COALESCE('(' || character_maximum_length || ')', '')
                WHEN data_type = 'character' THEN 
                  'CHAR' || COALESCE('(' || character_maximum_length || ')', '')
                WHEN data_type = 'timestamp without time zone' THEN 'TIMESTAMP'
                WHEN data_type = 'timestamp with time zone' THEN 'TIMESTAMPTZ'
                ELSE UPPER(data_type)
              END ||
              CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
              CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
              ', '
              ORDER BY ordinal_position
            ) || 
            COALESCE(
              ', CONSTRAINT "' || table_name || '_pkey" PRIMARY KEY (' || 
              (
                SELECT string_agg('"' || kcu.column_name || '"', ', ' ORDER BY kcu.ordinal_position)
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_name = c.table_name
                  AND tc.constraint_type = 'PRIMARY KEY'
              ) || ')',
              ''
            ) ||
            ');' AS create_statement
          FROM information_schema.columns c
          WHERE table_schema = 'public'
            AND table_name = $1
          GROUP BY table_name
        `, [tableName]);
        
        if (result.rows.length === 0) {
          console.log(`  ⚠️  Table ${tableName} not found in source database`);
          continue;
        }
        
        const createSQL = result.rows[0].create_statement;
        
        // Execute CREATE TABLE in target database
        await targetPool.query(createSQL);
        console.log(`  ✅ Created ${tableName}`);
        
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`  ℹ️  ${tableName} already exists (skipped)`);
        } else {
          console.error(`  ❌ Error creating ${tableName}:`, error.message);
        }
      }
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const verifyResult = await targetPool.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`✅ Total tables in manufacturing database: ${verifyResult.rows[0].table_count}`);
    
    console.log('\n🎉 Table creation completed!');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sourcePool.end();
    await targetPool.end();
    console.log('\n👋 Database connections closed');
  }
}

createMissingTables();
