const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const log = (msg) => {
  console.log(msg);
  fs.appendFileSync('cost-center-alter-migration.log', msg + '\n');
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

(async () => {
  // Clear log file
  fs.writeFileSync('cost-center-alter-migration.log', '');
  
  log('='.repeat(80));
  log('COST CENTER TABLES ALTER MIGRATION');
  log('='.repeat(80));
  log('');
  
  try {
    log('Step 1: Connecting to database...');
    const testConn = await pool.query('SELECT NOW()');
    log('✅ Connected at: ' + testConn.rows[0].now);
    log('');
    
    // =========================================================================
    // DROP COLUMNS FROM tblCostCenter
    // =========================================================================
    log('Step 2: Checking columns in tblCostCenter...');
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tblCostCenter'
      ORDER BY ordinal_position
    `);
    
    log('Current columns in tblCostCenter:');
    checkColumns.rows.forEach((col, i) => {
      log(`  ${i + 1}. ${col.column_name}`);
    });
    log('');
    
    const columnsToKeep = ['cc_id', 'cc_name', 'cc_no', 'description'];
    const columnsToDrop = ['created_by', 'created_on', 'changed_by', 'changed_on', 'org_id'];
    
    log('Step 3: Dropping columns from tblCostCenter...');
    for (const colName of columnsToDrop) {
      const exists = checkColumns.rows.find(c => c.column_name === colName);
      if (exists) {
        log(`  Dropping column: ${colName}...`);
        await pool.query(`ALTER TABLE "tblCostCenter" DROP COLUMN IF EXISTS ${colName};`);
        log(`  ✅ Dropped: ${colName}`);
      } else {
        log(`  ⚠️  Column ${colName} does not exist, skipping...`);
      }
    }
    log('✅ Column dropping completed!');
    log('');
    
    // Verify remaining columns
    const verifyColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tblCostCenter'
      ORDER BY ordinal_position
    `);
    
    log('Remaining columns in tblCostCenter:');
    verifyColumns.rows.forEach((col, i) => {
      log(`  ${i + 1}. ${col.column_name}`);
    });
    log('');
    
    // =========================================================================
    // ADD FOREIGN KEY TO tblBranchCostCenter
    // =========================================================================
    log('Step 4: Checking if foreign key already exists on tblBranchCostCenter...');
    const checkFK = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'tblBranchCostCenter' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'fk_branch_cost_center_cc'
    `);
    
    if (checkFK.rows.length > 0) {
      log('⚠️  Foreign key fk_branch_cost_center_cc already exists!');
      log('');
    } else {
      log('Step 5: Adding foreign key constraint to tblBranchCostCenter...');
      await pool.query(`
        ALTER TABLE "tblBranchCostCenter" 
        ADD CONSTRAINT fk_branch_cost_center_cc 
        FOREIGN KEY (cc_id) 
        REFERENCES "tblCostCenter" (cc_id)
        ON DELETE CASCADE;
      `);
      log('✅ Foreign key constraint added successfully!');
      log('   - Column: cc_id');
      log('   - References: tblCostCenter(cc_id)');
      log('   - On Delete: CASCADE');
      log('');
    }
    
    // =========================================================================
    // VERIFICATION
    // =========================================================================
    log('Step 6: Verifying changes...');
    log('');
    
    // Check foreign keys
    const fkList = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'tblBranchCostCenter'
      ORDER BY tc.constraint_name
    `);
    
    log('🔑 Foreign keys in tblBranchCostCenter:');
    if (fkList.rows.length === 0) {
      log('  No foreign keys found');
    } else {
      fkList.rows.forEach((fk, i) => {
        log(`  ${i + 1}. ${fk.constraint_name}`);
        log(`     ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
      });
    }
    log('');
    
    log('='.repeat(80));
    log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    log('='.repeat(80));
    log('');
    log('📝 Summary:');
    log('  - Dropped columns from tblCostCenter:');
    log('    • created_by');
    log('    • created_on');
    log('    • changed_by');
    log('    • changed_on');
    log('    • org_id');
    log('  - Added foreign key: tblBranchCostCenter.cc_id -> tblCostCenter.cc_id');
    log('');
    log('📄 Log file saved to: cost-center-alter-migration.log');
    
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
