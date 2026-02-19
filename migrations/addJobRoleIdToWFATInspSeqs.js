const pool = require('../config/db');

async function addJobRoleIdToWFATInspSeqs() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Adding job_role_id column to tblWFATInspSeqs...');
    
    // check if column already exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tblWFATInspSeqs' AND column_name = 'job_role_id'
    `;
    const checkResult = await client.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      // Add column
      await client.query(`
        ALTER TABLE "tblWFATInspSeqs" 
        ADD COLUMN job_role_id VARCHAR(20)
      `);
      console.log('✅ Added job_role_id column');
      
      // Add foreign key
      await client.query(`
        ALTER TABLE "tblWFATInspSeqs"
        ADD CONSTRAINT fk_wfatinspseqs_job_role
        FOREIGN KEY (job_role_id)
        REFERENCES "tblJobRoles" (job_role_id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      `);
      console.log('✅ Added foreign key constraint for job_role_id');
      
      // Seed data if needed - e.g. update existing rows to have a default job role
      // For now we leave them null, but we might need to update them manually or via script
      // Assuming JR001 is a valid Role.
      await client.query(`
        UPDATE "tblWFATInspSeqs"
        SET job_role_id = 'JR001'
        WHERE job_role_id IS NULL
      `);
       console.log('✅ Updated existing rows with default job_role_id = JR001');

    } else {
      console.log('ℹ️ Column job_role_id already exists');
    }
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  addJobRoleIdToWFATInspSeqs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { addJobRoleIdToWFATInspSeqs };
