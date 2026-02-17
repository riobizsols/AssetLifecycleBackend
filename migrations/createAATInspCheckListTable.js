/**
 * Migration: Create tblAATInspCheckList table for mapping inspection checklists to assets/asset types
 * 
 * This table maps inspection questions to specific assets or asset types
 * Values in this table have higher preference and override values from tblInspCheckList
 */

const { getDbFromContext } = require('../utils/dbContext');
const db = require('../config/db');

const getDb = () => {
  try {
    return getDbFromContext();
  } catch (err) {
    return db;
  }
};

const createAATInspCheckListTable = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Create tblAATInspCheckList table...');
    console.log(`✅ Database connected successfully at: ${new Date().toISOString()}`);
    
    // Check if table already exists
    const checkTable = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tblAATInspCheckList'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('ℹ️  tblAATInspCheckList table already exists');
      return;
    }
    
    // Create the table
    await dbPool.query(`
      CREATE TABLE "tblAATInspCheckList" (
        "AATIC_id" VARCHAR(50) PRIMARY KEY,
        "AT_id" VARCHAR(50),
        "Asset_id" VARCHAR(50),
        "Insp_check_id" VARCHAR(50) NOT NULL,
        "Expected_Value" VARCHAR(255),
        "Min_Range" NUMERIC(10, 2),
        "Max_range" NUMERIC(10, 2),
        "trigger_maintenance" BOOLEAN DEFAULT false,
        org_id VARCHAR(50) NOT NULL,
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Foreign key constraint for asset type
        CONSTRAINT fk_aatic_asset_type
          FOREIGN KEY ("AT_id")
          REFERENCES "tblAssetTypes" (asset_type_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for asset
        CONSTRAINT fk_aatic_asset
          FOREIGN KEY ("Asset_id")
          REFERENCES "tblAssets" (asset_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for inspection checklist
        CONSTRAINT fk_aatic_insp_check
          FOREIGN KEY ("Insp_check_id")
          REFERENCES "tblInspCheckList" ("Insp_Check_id")
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for org_id
        CONSTRAINT fk_aatic_org
          FOREIGN KEY (org_id)
          REFERENCES "tblOrgs" (org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Check constraint: Either AT_id or Asset_id must be provided (not both null)
        CONSTRAINT chk_aatic_at_or_asset
          CHECK ("AT_id" IS NOT NULL OR "Asset_id" IS NOT NULL)
      );
    `);
    
    console.log('✅ Created tblAATInspCheckList table');
    
    // Create indexes for better query performance
    await dbPool.query(`
      CREATE INDEX idx_aatic_at_id ON "tblAATInspCheckList" ("AT_id");
    `);
    console.log('✅ Created index on AT_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatic_asset_id ON "tblAATInspCheckList" ("Asset_id");
    `);
    console.log('✅ Created index on Asset_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatic_insp_check_id ON "tblAATInspCheckList" ("Insp_check_id");
    `);
    console.log('✅ Created index on Insp_check_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatic_org_id ON "tblAATInspCheckList" (org_id);
    `);
    console.log('✅ Created index on org_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatic_trigger_maintenance ON "tblAATInspCheckList" ("trigger_maintenance");
    `);
    console.log('✅ Created index on trigger_maintenance');
    
    console.log('✅ Migration completed successfully');
    console.log('📊 Summary: tblAATInspCheckList table created with constraints and indexes');
    console.log('📝 Column Details:');
    console.log('   - AATIC_id: Primary key for asset/asset type inspection checklist mapping');
    console.log('   - AT_id: Foreign key to tblAssetTypes (for asset type level mapping)');
    console.log('   - Asset_id: Foreign key to tblAssets (for asset level mapping)');
    console.log('   - Insp_check_id: Foreign key to tblInspCheckList (inspection question)');
    console.log('   - Expected_Value: Expected value (overrides tblInspCheckList)');
    console.log('   - Min_Range: Minimum range (overrides tblInspCheckList)');
    console.log('   - Max_range: Maximum range (overrides tblInspCheckList)');
    console.log('   - trigger_maintenance: Trigger maintenance flag (overrides tblInspCheckList)');
    console.log('   - +4F: Standard fields (org_id, created_by, created_on, changed_by, changed_on)');
    console.log('');
    console.log('⚠️  Note: Either AT_id or Asset_id must be provided (constraint enforced)');
    console.log('💡 Values in this table have HIGHER PREFERENCE and override tblInspCheckList values');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  createAATInspCheckListTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createAATInspCheckListTable };
