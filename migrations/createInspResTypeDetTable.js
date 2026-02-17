/**
 * Migration: Create tblInspResTypeDet table for inspection response type definitions
 * 
 * This table defines and manages inspection response types and their corresponding options
 * Used to populate the Response Type dropdown in Inspection Checklist configuration
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

const createInspResTypeDetTable = async () => {
  const dbPool = getDb();
  
  try {
    console.log('Starting migration: Create tblInspResTypeDet table...');
    console.log(`✅ Database connected successfully at: ${new Date().toISOString()}`);
    
    // Check if table already exists
    const checkTable = await dbPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tblInspResTypeDet'
      );
    `);
    
    if (checkTable.rows[0].exists) {
      console.log('ℹ️  tblInspResTypeDet table already exists');
      return;
    }
    
    // Create the table
    await dbPool.query(`
      CREATE TABLE "tblInspResTypeDet" (
        "IRTD_Id" VARCHAR(50) PRIMARY KEY,
        "Name" VARCHAR(100) NOT NULL,
        "Expected_Value" VARCHAR(255),
        "Option" VARCHAR(255),
        org_id VARCHAR(50) NOT NULL,
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        changed_by VARCHAR(50),
        changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Foreign key constraint for org_id
        CONSTRAINT fk_insprestypedet_org
          FOREIGN KEY (org_id)
          REFERENCES "tblOrgs" (org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    
    console.log('✅ Created tblInspResTypeDet table');
    
    // Create indexes for better query performance
    await dbPool.query(`
      CREATE INDEX idx_insprestypedet_name ON "tblInspResTypeDet" ("Name");
    `);
    console.log('✅ Created index on Name');
    
    await dbPool.query(`
      CREATE INDEX idx_insprestypedet_org_id ON "tblInspResTypeDet" (org_id);
    `);
    console.log('✅ Created index on org_id');
    
    console.log('✅ Migration completed successfully');
    console.log('📊 Summary: tblInspResTypeDet table created with constraints and indexes');
    console.log('📝 Column Details:');
    console.log('   - IRTD_Id: Primary key for inspection response type definition');
    console.log('   - Name: Response type category (QL_Yes_No, QL_Multi_Option, QN)');
    console.log('   - Expected_Value: Expected value for the response type');
    console.log('   - Option: Selectable response options');
    console.log('   - +4F: org_id, created_by, created_on, changed_by, changed_on');
    console.log('');
    console.log('💡 Example Data:');
    console.log('   Name: QL_Yes_No, Option: Yes');
    console.log('   Name: QL_Yes_No, Option: No');
    console.log('   Name: QL_Multi_Option, Option: Maybe');
    console.log('   Name: QL_Multi_Option, Option: Not Applicable');
    console.log('   Name: QL_Multi_Option, Option: Good');
    console.log('   Name: QL_Multi_Option, Option: Excellent');
    console.log('   Name: QN, Option: NULL (for numeric values)');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  createInspResTypeDetTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createInspResTypeDetTable };
