/**
 * Migration: Create tblAAT_Insp_Rec table for storing inspection records
 * 
 * This table stores actual inspection records with recorded values
 * If recorded value exceeds Min_Range/Max_Range, it should be displayed in RED in UI
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

const createAATInspRecTable = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Create tblAAT_Insp_Rec table...');
    console.log(`✅ Database connected successfully at: ${new Date().toISOString()}`);
    
    // Check if table already exists
    const checkTable = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tblAAT_Insp_Rec'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('ℹ️  tblAAT_Insp_Rec table already exists');
      return;
    }
    
    // Create the table
    await dbPool.query(`
      CREATE TABLE "tblAAT_Insp_Rec" (
        "ATTIRec_Id" VARCHAR(50) PRIMARY KEY,
        "AATISch_Id" VARCHAR(50) NOT NULL,
        "Insp_Check_Id" VARCHAR(50) NOT NULL,
        "Recorded_Value" VARCHAR(255),
        org_id VARCHAR(50) NOT NULL,
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Foreign key constraint for inspection schedule (tblAAT_Insp_Freq)
        CONSTRAINT fk_aatinsprec_schedule
          FOREIGN KEY ("AATISch_Id")
          REFERENCES "tblAAT_Insp_Freq" ("AATIF_id")
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for inspection checklist
        CONSTRAINT fk_aatinsprec_insp_check
          FOREIGN KEY ("Insp_Check_Id")
          REFERENCES "tblInspCheckList" ("Insp_Check_id")
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        -- Foreign key constraint for org_id
        CONSTRAINT fk_aatinsprec_org
          FOREIGN KEY (org_id)
          REFERENCES "tblOrgs" (org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    
    console.log('✅ Created tblAAT_Insp_Rec table');
    
    // Create indexes for better query performance
    await dbPool.query(`
      CREATE INDEX idx_aatinsprec_schedule_id ON "tblAAT_Insp_Rec" ("AATISch_Id");
    `);
    console.log('✅ Created index on AATISch_Id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatinsprec_insp_check_id ON "tblAAT_Insp_Rec" ("Insp_Check_Id");
    `);
    console.log('✅ Created index on Insp_Check_Id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatinsprec_org_id ON "tblAAT_Insp_Rec" (org_id);
    `);
    console.log('✅ Created index on org_id');
    
    await dbPool.query(`
      CREATE INDEX idx_aatinsprec_created_on ON "tblAAT_Insp_Rec" (created_on DESC);
    `);
    console.log('✅ Created index on created_on');
    
    console.log('✅ Migration completed successfully');
    console.log('📊 Summary: tblAAT_Insp_Rec table created with constraints and indexes');
    console.log('📝 Column Details:');
    console.log('   - ATTIRec_Id: Primary key for inspection record');
    console.log('   - AATISch_Id: Foreign key to tblAAT_Insp_Freq (inspection schedule)');
    console.log('   - Insp_Check_Id: Foreign key to tblInspCheckList (inspection question)');
    console.log('   - Recorded_Value: Actual recorded value during inspection');
    console.log('   - +2F: org_id, created_by, created_on');
    console.log('');
    console.log('⚠️  UI Business Rule:');
    console.log('   If Recorded_Value exceeds Min_Range/Max_Range from checklist configuration,');
    console.log('   the value MUST be displayed in RED in the UI');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  createAATInspRecTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createAATInspRecTable };
