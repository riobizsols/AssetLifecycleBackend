/**
 * Migration: Create tblAAT_Insp_Freq table for storing inspection frequency details
 * 
 * This table stores frequency of inspection, inspection name, UOM, and recurrence details
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

const createAATInspFreqTable = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Create tblAAT_Insp_Freq table...');
    console.log(`✅ Database connected successfully at: ${new Date().toISOString()}`);
    
    // Check if table already exists
    const checkTable = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tblAAT_Insp_Freq'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('ℹ️  tblAAT_Insp_Freq table already exists');
      return;
    }
    
    // Create the table
    await dbPool.query(`
      CREATE TABLE "tblAAT_Insp_Freq" (
        "AATIF_id" VARCHAR(50) PRIMARY KEY,
        "AAtIc_id" VARCHAR(50) NOT NULL,
        "Freq" INTEGER,
        "UOM" VARCHAR(50),
        "Text" TEXT,
        "maintained_by" VARCHAR(100),
        "int_status" INTEGER DEFAULT 1,
        org_id VARCHAR(50) NOT NULL,
        "Is_recurring" BOOLEAN DEFAULT TRUE,
        "Hours_required" NUMERIC(10, 2),
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Foreign key constraint for tblAATInspCheckList
        CONSTRAINT fk_aatif_aatic
          FOREIGN KEY ("AAtIc_id")
          REFERENCES "tblAATInspCheckList" ("AATIC_id")
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for org_id
        CONSTRAINT fk_aatif_org
          FOREIGN KEY (org_id)
          REFERENCES "tblOrgs" (org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    
    console.log('✅ Created tblAAT_Insp_Freq table');
    
    // Create indexes for better query performance
    await dbPool.query(`
      CREATE INDEX idx_aatif_aatic_id ON "tblAAT_Insp_Freq" ("AAtIc_id");
    `);
    console.log('✅ Created index on AAtIc_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatif_org_id ON "tblAAT_Insp_Freq" (org_id);
    `);
    console.log('✅ Created index on org_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatif_int_status ON "tblAAT_Insp_Freq" ("int_status");
    `);
    console.log('✅ Created index on int_status');
    
    await dbPool.query(`
      CREATE INDEX idx_aatif_is_recurring ON "tblAAT_Insp_Freq" ("Is_recurring");
    `);
    console.log('✅ Created index on Is_recurring');
    
    console.log('✅ Migration completed successfully');
    console.log('📊 Summary: tblAAT_Insp_Freq table created with constraints and indexes');
    console.log('📝 Column Details:');
    console.log('   - AATIF_id: Primary key for inspection frequency record');
    console.log('   - AAtIc_id: Foreign key to tblAATInspCheckList (inspection mapping)');
    console.log('   - Freq: Frequency value (integer)');
    console.log('   - UOM: Unit of Measure');
    console.log('   - Text: Inspection name/description');
    console.log('   - maintained_by: Who maintains the inspection');
    console.log('   - int_status: Internal status (default: 1)');
    console.log('   - org_id: Organization ID (FK to tblOrgs)');
    console.log('   - Is_recurring: Recurring flag (default: TRUE)');
    console.log('   - Hours_required: Hours required for inspection');
    console.log('   - +4F: Standard fields (org_id, created_by, created_on, changed_by, changed_on)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  createAATInspFreqTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createAATInspFreqTable };
