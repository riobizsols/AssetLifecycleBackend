const db = require('../config/db');

/**
 * Migration: Create inspection workflow tables (similar to maintenance tables)
 * Creates 5 new tables for inspection workflow management
 */

const createInspectionWorkflowTables = async () => {
  const client = await db.connect();
  
  try {
    console.log('\n=== CREATING INSPECTION WORKFLOW TABLES ===\n');

    await client.query('BEGIN');

    // 1. Create tblWFInspSteps (similar to tblWFSteps)
    console.log('1️⃣ Creating tblWFInspSteps...');
    await client.query(`
      DROP TABLE IF EXISTS "tblWFInspSteps" CASCADE;
    `);
    await client.query(`
      CREATE TABLE "tblWFInspSteps" (
        wf_insp_steps_id VARCHAR(20) PRIMARY KEY,
        org_id VARCHAR(20) NOT NULL,
        text VARCHAR(50) NOT NULL,
        
        CONSTRAINT fk_wfinspsteps_org 
          FOREIGN KEY (org_id) 
          REFERENCES "tblOrgs"(org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    await client.query(`
      CREATE INDEX idx_wfinspsteps_org_id ON "tblWFInspSteps"(org_id);
    `);
    console.log('   ✅ tblWFInspSteps created');

    // 2. Create tblWFInspJobRole (similar to tblWFJobRole)
    console.log('\n2️⃣ Creating tblWFInspJobRole...');
    await client.query(`
      DROP TABLE IF EXISTS "tblWFInspJobRole" CASCADE;
    `);
    await client.query(`
      CREATE TABLE "tblWFInspJobRole" (
        wf_insp_job_role_id VARCHAR(20) PRIMARY KEY,
        wf_insp_steps_id VARCHAR(20) NOT NULL,
        job_role_id VARCHAR(20) NOT NULL,
        emp_int_id VARCHAR(20),
        dept_id VARCHAR(20) NOT NULL,
        org_id VARCHAR(20) NOT NULL,
        
        CONSTRAINT fk_wfinspjobrole_wfinspsteps 
          FOREIGN KEY (wf_insp_steps_id) 
          REFERENCES "tblWFInspSteps"(wf_insp_steps_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_wfinspjobrole_org 
          FOREIGN KEY (org_id) 
          REFERENCES "tblOrgs"(org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    await client.query(`
      CREATE INDEX idx_wfinspjobrole_wfinspsteps ON "tblWFInspJobRole"(wf_insp_steps_id);
    `);
    await client.query(`
      CREATE INDEX idx_wfinspjobrole_org_id ON "tblWFInspJobRole"(org_id);
    `);
    console.log('   ✅ tblWFInspJobRole created');

    // 3. Create tblWFAATInspSch_H (similar to tblWFAssetMaintSch_H)
    console.log('\n3️⃣ Creating tblWFAATInspSch_H...');
    await client.query(`
      DROP TABLE IF EXISTS "tblWFAATInspSch_H" CASCADE;
    `);
    await client.query(`
      CREATE TABLE "tblWFAATInspSch_H" (
        wfaiish_id VARCHAR(20) PRIMARY KEY,
        aatif_id VARCHAR(20),
        asset_id VARCHAR(20),
        group_id VARCHAR(20),
        vendor_id VARCHAR(20),
        pl_sch_date TIMESTAMP NOT NULL,
        act_sch_date TIMESTAMP,
        status VARCHAR(2) NOT NULL,
        created_by VARCHAR(20) NOT NULL,
        created_on TIMESTAMP,
        changed_by VARCHAR(20),
        changed_on TIMESTAMP,
        org_id VARCHAR(20),
        existing_ais_id VARCHAR(50),
        branch_code VARCHAR(10),
        
        CONSTRAINT fk_wfaatinspschh_aatif 
          FOREIGN KEY (aatif_id) 
          REFERENCES "tblAAT_Insp_Freq"(aatif_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_wfaatinspschh_org 
          FOREIGN KEY (org_id) 
          REFERENCES "tblOrgs"(org_id)
          ON DELETE SET NULL
          ON UPDATE CASCADE
      );
    `);
    await client.query(`
      CREATE INDEX idx_wfaatinspschh_aatif ON "tblWFAATInspSch_H"(aatif_id);
    `);
    await client.query(`
      CREATE INDEX idx_wfaatinspschh_org_id ON "tblWFAATInspSch_H"(org_id);
    `);
    await client.query(`
      CREATE INDEX idx_wfaatinspschh_status ON "tblWFAATInspSch_H"(status);
    `);
    console.log('   ✅ tblWFAATInspSch_H created');

    // 4. Create tblWFAATInspSch_D (similar to tblWFAssetMaintSch_D)
    console.log('\n4️⃣ Creating tblWFAATInspSch_D...');
    await client.query(`
      DROP TABLE IF EXISTS "tblWFAATInspSch_D" CASCADE;
    `);
    await client.query(`
      CREATE TABLE "tblWFAATInspSch_D" (
        wfaiisd_id VARCHAR(20) PRIMARY KEY,
        wfaiish_id VARCHAR(20) NOT NULL,
        job_role_id VARCHAR(20) NOT NULL,
        dept_id VARCHAR(20) NOT NULL,
        sequence INTEGER NOT NULL,
        status VARCHAR(2) NOT NULL,
        notes VARCHAR(100),
        created_by VARCHAR(20) NOT NULL,
        created_on TIMESTAMP,
        changed_by VARCHAR(20),
        changed_on TIMESTAMP,
        org_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(50),
        
        CONSTRAINT fk_wfaatinspschd_wfaatinspschh 
          FOREIGN KEY (wfaiish_id) 
          REFERENCES "tblWFAATInspSch_H"(wfaiish_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_wfaatinspschd_org 
          FOREIGN KEY (org_id) 
          REFERENCES "tblOrgs"(org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    await client.query(`
      CREATE INDEX idx_wfaatinspschd_wfaiish ON "tblWFAATInspSch_D"(wfaiish_id);
    `);
    await client.query(`
      CREATE INDEX idx_wfaatinspschd_org_id ON "tblWFAATInspSch_D"(org_id);
    `);
    await client.query(`
      CREATE INDEX idx_wfaatinspschd_status ON "tblWFAATInspSch_D"(status);
    `);
    console.log('   ✅ tblWFAATInspSch_D created');

    // 5. Create tblWFAATInspHist (similar to tblWFAssetMaintHist)
    console.log('\n5️⃣ Creating tblWFAATInspHist...');
    await client.query(`
      DROP TABLE IF EXISTS "tblWFAATInspHist" CASCADE;
    `);
    await client.query(`
      CREATE TABLE "tblWFAATInspHist" (
        wfaiishis_id VARCHAR(20) PRIMARY KEY,
        wfaiish_id VARCHAR(20) NOT NULL,
        wfaiisd_id VARCHAR(20) NOT NULL,
        action_by VARCHAR(20) NOT NULL,
        action_on TIMESTAMP NOT NULL,
        action VARCHAR(2) NOT NULL,
        notes VARCHAR(100),
        org_id VARCHAR(20) NOT NULL,
        
        CONSTRAINT fk_wfaatinsphist_wfaatinspschh 
          FOREIGN KEY (wfaiish_id) 
          REFERENCES "tblWFAATInspSch_H"(wfaiish_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_wfaatinsphist_wfaatinspschd 
          FOREIGN KEY (wfaiisd_id) 
          REFERENCES "tblWFAATInspSch_D"(wfaiisd_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
          
        CONSTRAINT fk_wfaatinsphist_org 
          FOREIGN KEY (org_id) 
          REFERENCES "tblOrgs"(org_id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      );
    `);
    await client.query(`
      CREATE INDEX idx_wfaatinsphist_wfaiish ON "tblWFAATInspHist"(wfaiish_id);
    `);
    await client.query(`
      CREATE INDEX idx_wfaatinsphist_wfaiisd ON "tblWFAATInspHist"(wfaiisd_id);
    `);
    await client.query(`
      CREATE INDEX idx_wfaatinsphist_org_id ON "tblWFAATInspHist"(org_id);
    `);
    console.log('   ✅ tblWFAATInspHist created');

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   1. tblWFInspSteps - Workflow inspection steps');
    console.log('   2. tblWFInspJobRole - Job roles for inspection workflow steps');
    console.log('   3. tblWFAATInspSch_H - Inspection schedule header (workflow)');
    console.log('   4. tblWFAATInspSch_D - Inspection schedule details (workflow)');
    console.log('   5. tblWFAATInspHist - Inspection workflow history');
    console.log('\n💡 All tables created with proper foreign keys and indexes.');
    console.log('   Column names follow lowercase convention.\n');
    console.log('📝 Tables NOT created (as requested):');
    console.log('   - tblWFATInspSeqs (already exists)');
    console.log('   - tblAAT_Insp_Rec (already exists)\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
};

// Run migration
createInspectionWorkflowTables()
  .then(() => {
    console.log('Migration process completed');
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
