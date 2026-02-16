const db = require('../config/db');

/**
 * Migration: Create tblATInspCerts table
 * Purpose: Junction table linking inspection checklists with technical certificates
 */

const createATInspCertsTable = async () => {
  const client = await db.connect();
  
  try {
    console.log('Starting migration: Create tblATInspCerts table...');

    // Get database from context or fallback to db
    const getDbFromContext = () => client || db;
    const database = getDbFromContext();

    // Drop existing table if exists (for recreation)
    await database.query(`
      DROP TABLE IF EXISTS "tblATInspCerts" CASCADE;
    `);

    // Create tblATInspCerts table
    await database.query(`
      CREATE TABLE "tblATInspCerts" (
        "ATIC_id" VARCHAR(50) PRIMARY KEY,
        "AAtIc_id" VARCHAR(50) NOT NULL,
        "TC_id" VARCHAR(50) NOT NULL,
        created_by VARCHAR(50),
        created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Foreign Keys
        CONSTRAINT fk_atinspcerts_aatinspchecklist 
          FOREIGN KEY ("AAtIc_id") 
          REFERENCES "tblAATInspCheckList"("AATIC_id")
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_atinspcerts_techcert 
          FOREIGN KEY ("TC_id") 
          REFERENCES "tblTechCert"(tc_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    console.log('✅ Created tblATInspCerts table');

    // Create indexes for better query performance
    await database.query(`
      CREATE INDEX idx_atinspcerts_aatic_id ON "tblATInspCerts"("AAtIc_id");
    `);
    console.log('✅ Created index on AAtIc_id');

    await database.query(`
      CREATE INDEX idx_atinspcerts_tc_id ON "tblATInspCerts"("TC_id");
    `);
    console.log('✅ Created index on TC_id');

    await database.query(`
      CREATE INDEX idx_atinspcerts_created_by ON "tblATInspCerts"(created_by);
    `);
    console.log('✅ Created index on created_by');

    console.log('✅ Migration completed successfully');
    console.log('📊 Summary: tblATInspCerts table created with foreign keys and indexes');
    console.log('📝 Column Details:');
    console.log('   - ATIC_id: Primary key');
    console.log('   - AAtIc_id: Foreign key to tblAATInspCheckList(AATIC_id)');
    console.log('   - TC_id: Foreign key to tblTechCert(tc_id)');
    console.log('   - created_by: User who created the record');
    console.log('   - created_on: Timestamp of creation');
    console.log('');
    console.log('💡 Purpose: Links inspection checklists with technical certificates');
    console.log('   Example: Forklift inspection requires Forklift Operator Certificate');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await db.end();
  }
};

// Run migration
createATInspCertsTable()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
