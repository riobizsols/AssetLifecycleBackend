/**
 * Migration: Create tblAAT_Insp_Sch table for inspection scheduling
 * 
 * This table is similar to tblAssetMaintSch but for inspection management
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

const createAATInspSchTable = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Create tblAAT_Insp_Sch table...');
    console.log(`✅ Database connected successfully at: ${new Date().toISOString()}`);
    
    // Check if table already exists
    const checkTable = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tblAAT_Insp_Sch'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('⚠️  tblAAT_Insp_Sch table already exists, dropping it...');
      await dbPool.query(`DROP TABLE "tblAAT_Insp_Sch" CASCADE;`);
      console.log('✅ Dropped existing table');
    }
    
    // Create the table (similar structure to tblAssetMaintSch)
    await dbPool.query(`
      CREATE TABLE "tblAAT_Insp_Sch" (
        ais_id VARCHAR(20) PRIMARY KEY,
        wfaiis_id VARCHAR(20),
        asset_id VARCHAR(20) NOT NULL,
        vendor_id VARCHAR(20),
        aatif_id VARCHAR(50),
        inspected_by VARCHAR(20),
        notes VARCHAR(100),
        status VARCHAR(2) NOT NULL,
        act_insp_st_date TIMESTAMP NOT NULL,
        act_insp_end_date TIMESTAMP,
        po_number VARCHAR(30),
        invoice VARCHAR(30),
        inspector_name VARCHAR(50),
        inspector_email VARCHAR(50),
        inspector_phno VARCHAR(20),
        created_by VARCHAR(20) NOT NULL,
        created_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(20),
        changed_on TIMESTAMP,
        org_id VARCHAR(20) NOT NULL,
        io_id VARCHAR(50),
        branch_id VARCHAR(10),
        cost NUMERIC,
        
        -- Foreign key constraint for asset
        CONSTRAINT fk_aatinspsch_asset
          FOREIGN KEY (asset_id)
          REFERENCES "tblAssets" (asset_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for vendor
        CONSTRAINT fk_aatinspsch_vendor
          FOREIGN KEY (vendor_id)
          REFERENCES "tblVendors" (vendor_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for inspection frequency
        CONSTRAINT fk_aatinspsch_freq
          FOREIGN KEY (aatif_id)
          REFERENCES "tblAAT_Insp_Freq" ("AATIF_id")
          ON DELETE SET NULL
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for branch
        CONSTRAINT fk_aatinspsch_branch
          FOREIGN KEY (branch_id)
          REFERENCES "tblBranches" (branch_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for org_id
        CONSTRAINT fk_aatinspsch_org
          FOREIGN KEY (org_id)
          REFERENCES "tblOrgs" (org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    
    console.log('✅ Created tblAAT_Insp_Sch table');
    
    // Create indexes for better query performance
    await dbPool.query(`
      CREATE INDEX idx_aatinspsch_asset_id ON "tblAAT_Insp_Sch" (asset_id);
    `);
    console.log('✅ Created index on asset_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatinspsch_vendor_id ON "tblAAT_Insp_Sch" (vendor_id);
    `);
    console.log('✅ Created index on vendor_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatinspsch_aatif_id ON "tblAAT_Insp_Sch" (aatif_id);
    `);
    console.log('✅ Created index on aatif_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatinspsch_status ON "tblAAT_Insp_Sch" (status);
    `);
    console.log('✅ Created index on status');
    
    await dbPool.query(`
      CREATE INDEX idx_aatinspsch_org_id ON "tblAAT_Insp_Sch" (org_id);
    `);
    console.log('✅ Created index on org_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatinspsch_branch_id ON "tblAAT_Insp_Sch" (branch_id);
    `);
    console.log('✅ Created index on branch_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatinspsch_act_insp_st_date ON "tblAAT_Insp_Sch" (act_insp_st_date DESC);
    `);
    console.log('✅ Created index on act_insp_st_date');
    
    console.log('✅ Migration completed successfully');
    console.log('📊 Summary: tblAAT_Insp_Sch table created with structure similar to tblAssetMaintSch');
    console.log('📝 Column Details:');
    console.log('   - ais_id: Primary key (Inspection Schedule ID)');
    console.log('   - wfaiis_id: Workflow Asset Inspection Header ID');
    console.log('   - asset_id: FK to tblAssets');
    console.log('   - vendor_id: FK to tblVendors');
    console.log('   - aatif_id: FK to tblAAT_Insp_Freq (inspection frequency)');
    console.log('   - inspected_by: Who performed the inspection');
    console.log('   - notes: Inspection notes');
    console.log('   - status: Inspection status (2 char code)');
    console.log('   - act_insp_st_date: Actual inspection start date');
    console.log('   - act_insp_end_date: Actual inspection end date');
    console.log('   - po_number: Purchase order number');
    console.log('   - invoice: Invoice number');
    console.log('   - inspector_name: Inspector name');
    console.log('   - inspector_email: Inspector email');
    console.log('   - inspector_phno: Inspector phone number');
    console.log('   - io_id: Inspection order ID');
    console.log('   - branch_id: FK to tblBranches');
    console.log('   - cost: Inspection cost');
    console.log('   - +4F: created_by, created_on, changed_by, changed_on, org_id');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  createAATInspSchTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createAATInspSchTable };
