/**
 * Migration: Create tblInspCheckList table for inspection checklists
 * 
 * This table stores inspection questions with their response types and expected values
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

const createInspCheckListTable = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Create tblInspCheckList table...');
    console.log(`✅ Database connected successfully at: ${new Date().toISOString()}`);
    
    // Check if table already exists
    const checkTable = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tblInspCheckList'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('ℹ️  tblInspCheckList table already exists');
      return;
    }
    
    // Create the table
    await dbPool.query(`
      CREATE TABLE "tblInspCheckList" (
        "Insp_Check_id" VARCHAR(50) PRIMARY KEY,
        "Inspection_text" TEXT NOT NULL,
        "Response_Type" VARCHAR(10) NOT NULL CHECK ("Response_Type" IN ('QL', 'QN')),
        "Expected_Value" VARCHAR(255),
        "Min_Range" NUMERIC(10, 2),
        "Max_range" NUMERIC(10, 2),
        "trigger_maintenance" BOOLEAN DEFAULT false,
        org_id VARCHAR(50) NOT NULL,
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Foreign key constraint for org_id
        CONSTRAINT fk_insp_checklist_org
          FOREIGN KEY (org_id)
          REFERENCES "tblOrgs" (org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    
    console.log('✅ Created tblInspCheckList table');
    
    // Create indexes for better query performance
    await dbPool.query(`
      CREATE INDEX idx_insp_checklist_org_id ON "tblInspCheckList" (org_id);
    `);
    console.log('✅ Created index on org_id');
    
    await dbPool.query(`
      CREATE INDEX idx_insp_checklist_response_type ON "tblInspCheckList" ("Response_Type");
    `);
    console.log('✅ Created index on Response_Type');
    
    await dbPool.query(`
      CREATE INDEX idx_insp_checklist_trigger_maintenance ON "tblInspCheckList" ("trigger_maintenance");
    `);
    console.log('✅ Created index on trigger_maintenance');
    
    console.log('✅ Migration completed successfully');
    console.log('📊 Summary: tblInspCheckList table created with constraints and indexes');
    console.log('📝 Column Details:');
    console.log('   - Insp_Check_id: Primary key for inspection checklist item');
    console.log('   - Inspection_text: The inspection question/item text');
    console.log('   - Response_Type: QL (Qualitative) or QN (Quantitative)');
    console.log('   - Expected_Value: Expected value for the inspection');
    console.log('   - Min_Range: Minimum acceptable range (for quantitative)');
    console.log('   - Max_range: Maximum acceptable range (for quantitative)');
    console.log('   - trigger_maintenance: Boolean flag to trigger maintenance');
    console.log('   - +4F: Standard fields (org_id, created_by, created_on, changed_by, changed_on)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  createInspCheckListTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createInspCheckListTable };
