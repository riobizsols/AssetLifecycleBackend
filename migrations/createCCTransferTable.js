/**
 * Migration: Create tblCCTransfer table for cost center transfer history
 * 
 * This table tracks all cost center transfers including branch and cost center changes
 */

const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

const createCCTransferTable = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Create tblCCTransfer table...');
    console.log(`✅ Database connected successfully at: ${new Date().toISOString()}`);
    
    // Check if table already exists
    const checkTable = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tblCCTransfer'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('ℹ️  tblCCTransfer table already exists');
      return;
    }
    
    // Create the table
    await dbPool.query(`
      CREATE TABLE "tblCCTransfer" (
        cc_transfer_id VARCHAR(50) PRIMARY KEY,
        asset_id VARCHAR(50) NOT NULL,
        current_branch_id VARCHAR(50),
        current_cost_center_code VARCHAR(50),
        new_branch_id VARCHAR(50),
        new_cost_center_code VARCHAR(50),
        transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        transferred_by VARCHAR(50),
        org_id VARCHAR(50) NOT NULL,
        int_status INTEGER DEFAULT 1,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Foreign key constraints
        CONSTRAINT fk_cc_transfer_asset
          FOREIGN KEY (asset_id)
          REFERENCES "tblAssets" (asset_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_cc_transfer_current_branch
          FOREIGN KEY (current_branch_id)
          REFERENCES "tblBranches" (branch_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_cc_transfer_new_branch
          FOREIGN KEY (new_branch_id)
          REFERENCES "tblBranches" (branch_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_cc_transfer_current_cc
          FOREIGN KEY (current_cost_center_code)
          REFERENCES "tblCostCenter" (cc_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_cc_transfer_new_cc
          FOREIGN KEY (new_cost_center_code)
          REFERENCES "tblCostCenter" (cc_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_cc_transfer_org
          FOREIGN KEY (org_id)
          REFERENCES "tblOrgs" (org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    
    console.log('✅ Created tblCCTransfer table');
    
    // Create indexes for better query performance
    await dbPool.query(`
      CREATE INDEX idx_cc_transfer_asset_id ON "tblCCTransfer" (asset_id);
    `);
    console.log('✅ Created index on asset_id');
    
    await dbPool.query(`
      CREATE INDEX idx_cc_transfer_transferred_at ON "tblCCTransfer" (transferred_at DESC);
    `);
    console.log('✅ Created index on transferred_at');
    
    await dbPool.query(`
      CREATE INDEX idx_cc_transfer_org_id ON "tblCCTransfer" (org_id);
    `);
    console.log('✅ Created index on org_id');
    
    console.log('✅ Migration completed successfully');
    console.log('📊 Summary: tblCCTransfer table created with foreign key constraints and indexes');
    console.log('📝 Note: This table will track all cost center transfer history');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  createCCTransferTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createCCTransferTable };
