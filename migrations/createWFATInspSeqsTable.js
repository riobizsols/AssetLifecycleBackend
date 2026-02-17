/**
 * Migration: Create tblWFATInspSeqs table for workflow asset type inspection sequences
 * 
 * This table has the same structure as tblWFATSeqs but for inspection workflows
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

const createWFATInspSeqsTable = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Create tblWFATInspSeqs table...');
    console.log(`✅ Database connected successfully at: ${new Date().toISOString()}`);
    
    // Check if table already exists
    const checkTable = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tblWFATInspSeqs'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('ℹ️  tblWFATInspSeqs table already exists');
      return;
    }
    
    // Create the table (same structure as tblWFATSeqs)
    await dbPool.query(`
      CREATE TABLE "tblWFATInspSeqs" (
        "WFATIS_id" VARCHAR(10) PRIMARY KEY,
        "At_id" VARCHAR(20) NOT NULL,
        "WF_steps_id" VARCHAR(20),
        "Seqs_no" VARCHAR(20),
        org_id VARCHAR(20) NOT NULL,
        
        -- Foreign key constraint for asset type
        CONSTRAINT fk_tblwfatinspseqs_asset_type_id
          FOREIGN KEY ("At_id")
          REFERENCES "tblAssetTypes" (asset_type_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for workflow steps
        CONSTRAINT fk_tblwfatinspseqs_wf_steps_id
          FOREIGN KEY ("WF_steps_id")
          REFERENCES "tblWFSteps" (wf_steps_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for org_id
        CONSTRAINT fk_tblwfatinspseqs_org_id
          FOREIGN KEY (org_id)
          REFERENCES "tblOrgs" (org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    
    console.log('✅ Created tblWFATInspSeqs table');
    
    // Create indexes for better query performance (same as tblWFATSeqs)
    await dbPool.query(`
      CREATE INDEX idx_wfatinspseqs_at_id ON "tblWFATInspSeqs" ("At_id");
    `);
    console.log('✅ Created index on At_id');
    
    await dbPool.query(`
      CREATE INDEX idx_wfatinspseqs_wf_steps_id ON "tblWFATInspSeqs" ("WF_steps_id");
    `);
    console.log('✅ Created index on WF_steps_id');
    
    await dbPool.query(`
      CREATE INDEX idx_wfatinspseqs_org_id ON "tblWFATInspSeqs" (org_id);
    `);
    console.log('✅ Created index on org_id');
    
    console.log('✅ Migration completed successfully');
    console.log('📊 Summary: tblWFATInspSeqs table created with same structure as tblWFATSeqs');
    console.log('📝 Column Details:');
    console.log('   - WFATIS_id: Primary key (VARCHAR 10)');
    console.log('   - At_id: Asset Type ID (FK to tblAssetTypes, VARCHAR 20, NOT NULL)');
    console.log('   - WF_steps_id: Workflow Steps ID (FK to tblWFSteps, VARCHAR 20)');
    console.log('   - Seqs_no: Sequence number (VARCHAR 20)');
    console.log('   - org_id: Organization ID (FK to tblOrgs, VARCHAR 20, NOT NULL)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  createWFATInspSeqsTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createWFATInspSeqsTable };
