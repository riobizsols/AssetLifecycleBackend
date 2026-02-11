const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const log = (msg) => {
  console.log(msg);
  fs.appendFileSync('cost-center-migration.log', msg + '\n');
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

(async () => {
  // Clear log file
  fs.writeFileSync('cost-center-migration.log', '');
  
  log('='.repeat(80));
  log('COST CENTER TABLES MIGRATION');
  log('='.repeat(80));
  log('');
  
  try {
    log('Step 1: Connecting to database...');
    const testConn = await pool.query('SELECT NOW()');
    log('✅ Connected at: ' + testConn.rows[0].now);
    log('');
    
    // =========================================================================
    // CHECK AND CREATE tblCostCenter
    // =========================================================================
    log('Step 2: Checking if tblCostCenter exists...');
    const checkCostCenter = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tblCostCenter'
    `);
    
    if (checkCostCenter.rows.length > 0) {
      log('✅ tblCostCenter ALREADY EXISTS!');
      log('');
      
      // Get columns
      const cols = await pool.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = 'tblCostCenter' 
        ORDER BY ordinal_position
      `);
      
      log(`Table has ${cols.rows.length} columns:`);
      cols.rows.forEach((col, i) => {
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        log(`  ${i + 1}. ${col.column_name} - ${col.data_type}${length}`);
      });
      log('');
      
    } else {
      log('⚠️  tblCostCenter DOES NOT EXIST - Creating now...');
      log('');
      
      log('Step 3: Creating tblCostCenter...');
      await pool.query(`
        CREATE TABLE "tblCostCenter" (
          cc_id VARCHAR(50) PRIMARY KEY,
          cc_name VARCHAR(255) NOT NULL,
          cc_no VARCHAR(50) NOT NULL,
          description TEXT,
          org_id VARCHAR(50) NOT NULL,
          created_by VARCHAR(50),
          created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          changed_by VARCHAR(50),
          changed_on TIMESTAMP
        );
      `);
      log('✅ tblCostCenter created successfully!');
      log('');
      
      log('Step 4: Creating indexes for tblCostCenter...');
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cost_center_org_id ON "tblCostCenter" (org_id);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cost_center_cc_no ON "tblCostCenter" (cc_no);
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_center_unique_cc_no_per_org 
        ON "tblCostCenter" (cc_no, org_id);
      `);
      log('✅ Indexes created successfully!');
      log('');
    }
    
    // =========================================================================
    // CHECK AND CREATE tblBranchCostCenter
    // =========================================================================
    log('Step 5: Checking if tblBranchCostCenter exists...');
    const checkBranchCostCenter = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tblBranchCostCenter'
    `);
    
    if (checkBranchCostCenter.rows.length > 0) {
      log('✅ tblBranchCostCenter ALREADY EXISTS!');
      log('');
      
      // Get columns
      const cols = await pool.query(`
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = 'tblBranchCostCenter' 
        ORDER BY ordinal_position
      `);
      
      log(`Table has ${cols.rows.length} columns:`);
      cols.rows.forEach((col, i) => {
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        log(`  ${i + 1}. ${col.column_name} - ${col.data_type}${length}`);
      });
      log('');
      
    } else {
      log('⚠️  tblBranchCostCenter DOES NOT EXIST - Creating now...');
      log('');
      
      log('Step 6: Creating tblBranchCostCenter...');
      await pool.query(`
        CREATE TABLE "tblBranchCostCenter" (
          bcc_id VARCHAR(50) PRIMARY KEY,
          branch_id VARCHAR(50) NOT NULL,
          cc_id VARCHAR(50) NOT NULL,
          org_id VARCHAR(50) NOT NULL,
          created_by VARCHAR(50),
          created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          changed_by VARCHAR(50),
          changed_on TIMESTAMP
        );
      `);
      log('✅ tblBranchCostCenter created successfully!');
      log('');
      
      log('Step 7: Creating indexes for tblBranchCostCenter...');
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_branch_cost_center_branch_id 
        ON "tblBranchCostCenter" (branch_id);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_branch_cost_center_cc_id 
        ON "tblBranchCostCenter" (cc_id);
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_branch_cost_center_org_id 
        ON "tblBranchCostCenter" (org_id);
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_cost_center_unique 
        ON "tblBranchCostCenter" (branch_id, cc_id, org_id);
      `);
      log('✅ Indexes created successfully!');
      log('');
    }
    
    // =========================================================================
    // VERIFICATION
    // =========================================================================
    log('Step 8: Verifying tables...');
    log('');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('tblCostCenter', 'tblBranchCostCenter')
      ORDER BY table_name
    `);
    
    log('📊 Tables created:');
    tables.rows.forEach((t, i) => {
      log(`  ${i + 1}. ${t.table_name}`);
    });
    log('');
    
    const indexes = await pool.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE tablename IN ('tblCostCenter', 'tblBranchCostCenter')
      ORDER BY tablename, indexname
    `);
    
    log('🔑 Indexes created:');
    indexes.rows.forEach((idx, i) => {
      log(`  ${i + 1}. ${idx.tablename}.${idx.indexname}`);
    });
    log('');
    
    log('='.repeat(80));
    log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    log('='.repeat(80));
    log('');
    log('📝 Summary:');
    log('  - tblCostCenter: Created/Verified');
    log('  - tblBranchCostCenter: Created/Verified');
    log('  - All indexes created');
    log('');
    log('📄 Log file saved to: cost-center-migration.log');
    
  } catch (err) {
    log('');
    log('❌ ERROR OCCURRED:');
    log('='.repeat(80));
    log('Error: ' + err.message);
    log('');
    log('Stack trace:');
    log(err.stack);
    log('');
    process.exit(1);
  } finally {
    await pool.end();
    log('');
    log('Database connection closed.');
    process.exit(0);
  }
})();
