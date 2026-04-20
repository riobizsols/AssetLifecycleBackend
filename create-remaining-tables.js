/**
 * Create remaining tables with sequences
 */

require('dotenv').config();
const { Pool } = require('pg');

async function createRemainingTables() {
  console.log('🚀 Creating remaining tables with sequences...');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // tblTechnicalLogConfig (CRITICAL for login)
    console.log('\n🔨 Creating tblTechnicalLogConfig...');
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS "tblTechnicalLogConfig_id_seq";
      
      CREATE TABLE IF NOT EXISTS "tblTechnicalLogConfig" (
        id INTEGER NOT NULL DEFAULT nextval('"tblTechnicalLogConfig_id_seq"'::regclass),
        org_id VARCHAR(50) NOT NULL,
        config_key VARCHAR(255) NOT NULL,
        config_value TEXT,
        description TEXT,
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP,
        CONSTRAINT "tblTechnicalLogConfig_pkey" PRIMARY KEY (id),
        CONSTRAINT "tblTechnicalLogConfig_unique" UNIQUE (org_id, config_key)
      );
    `);
    console.log('✅ tblTechnicalLogConfig created');

    // tblStatusCodes
    console.log('\n🔨 Creating tblStatusCodes...');
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS "tblStatusCodes_id_seq";
      
      CREATE TABLE IF NOT EXISTS "tblStatusCodes" (
        id INTEGER NOT NULL DEFAULT nextval('"tblStatusCodes_id_seq"'::regclass),
        status_code VARCHAR(10) NOT NULL,
        status_text VARCHAR(255),
        status_type VARCHAR(50),
        org_id VARCHAR(50),
        CONSTRAINT "tblStatusCodes_pkey" PRIMARY KEY (id)
      );
    `);
    console.log('✅ tblStatusCodes created');

    // tblTableFilterColumns
    console.log('\n🔨 Creating tblTableFilterColumns...');
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS "tbltablefiltercolumns_id_seq";
      
      CREATE TABLE IF NOT EXISTS "tblTableFilterColumns" (
        id INTEGER NOT NULL DEFAULT nextval('"tbltablefiltercolumns_id_seq"'::regclass),
        table_name VARCHAR(255) NOT NULL,
        column_name VARCHAR(255) NOT NULL,
        filter_type VARCHAR(50),
        is_filterable BOOLEAN DEFAULT true,
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tblTableFilterColumns_pkey" PRIMARY KEY (id)
      );
    `);
    console.log('✅ tblTableFilterColumns created');

    // tblvendorslarecs
    console.log('\n🔨 Creating tblvendorslarecs...');
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS "tblvendorslarecs_vslar_id_seq";
      
      CREATE TABLE IF NOT EXISTS "tblvendorslarecs" (
        vslar_id VARCHAR(50) NOT NULL DEFAULT nextval('"tblvendorslarecs_vslar_id_seq"'::regclass),
        vendor_id VARCHAR(50),
        sla_id VARCHAR(50),
        org_id VARCHAR(50),
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP,
        CONSTRAINT "tblvendorslarecs_pkey" PRIMARY KEY (vslar_id)
      );
    `);
    console.log('✅ tblvendorslarecs created');

    // tblWFAssetMaintSch_D (with ARRAY handling)
    console.log('\n🔨 Creating tblWFAssetMaintSch_D...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tblWFAssetMaintSch_D" (
        wfamscd_id VARCHAR(50) NOT NULL,
        wfamsh_id VARCHAR(50) NOT NULL,
        asset_id VARCHAR(50),
        org_id VARCHAR(50),
        branch_code VARCHAR(50),
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP,
        selected_assets TEXT[], -- ARRAY type for selected assets
        CONSTRAINT "tblWFAssetMaintSch_D_pkey" PRIMARY KEY (wfamscd_id)
      );
    `);
    console.log('✅ tblWFAssetMaintSch_D created');

    // Verify final table count
    console.log('\n🔍 Verifying final table count...');
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log(`✅ Total tables in manufacturing database: ${verifyResult.rows[0].table_count}`);
    
    console.log('\n🎉 All remaining tables created successfully!');
    console.log('\n✅ You should now be able to login without "tblTechnicalLogConfig does not exist" errors!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n👋 Database connection closed');
  }
}

createRemainingTables();
