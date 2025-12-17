const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const log = (msg) => {
  console.log(msg);
  fs.appendFileSync('table-status.txt', msg + '\n');
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

(async () => {
  // Clear log file
  fs.writeFileSync('table-status.txt', '');
  
  log('='.repeat(60));
  log('VENDOR RENEWAL TABLE CHECK & CREATE');
  log('='.repeat(60));
  log('');
  
  try {
    log('Step 1: Connecting to database...');
    const testConn = await pool.query('SELECT NOW()');
    log('✅ Connected at: ' + testConn.rows[0].now);
    log('');
    
    log('Step 2: Checking if table exists...');
    const checkTable = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tblVendorRenewal'
    `);
    
    if (checkTable.rows.length > 0) {
      log('✅ TABLE ALREADY EXISTS!');
      log('');
      
      // Get columns
      const cols = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tblVendorRenewal' 
        ORDER BY ordinal_position
      `);
      
      log(`Table has ${cols.rows.length} columns:`);
      cols.rows.forEach((col, i) => {
        log(`  ${i + 1}. ${col.column_name} (${col.data_type})`);
      });
      
    } else {
      log('⚠️  TABLE DOES NOT EXIST - Creating now...');
      log('');
      
      log('Step 3: Creating table...');
      await pool.query(`
        CREATE TABLE "tblVendorRenewal" (
          vr_id VARCHAR(50) PRIMARY KEY,
          wfamsh_id VARCHAR(50) NOT NULL,
          vendor_id VARCHAR(50) NOT NULL,
          vendor_name VARCHAR(255),
          contract_start_date DATE,
          contract_end_date DATE,
          previous_contract_end_date DATE,
          renewal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          renewal_approved_by VARCHAR(50),
          renewal_notes TEXT,
          status VARCHAR(10) DEFAULT 'CO',
          org_id VARCHAR(50) NOT NULL,
          branch_code VARCHAR(50),
          created_by VARCHAR(50),
          created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          changed_by VARCHAR(50),
          changed_on TIMESTAMP
        );
      `);
      log('✅ Table created successfully!');
      log('');
      
      log('Step 4: Creating indexes...');
      await pool.query('CREATE INDEX idx_vendor_renewal_vendor_id ON "tblVendorRenewal" (vendor_id)');
      await pool.query('CREATE INDEX idx_vendor_renewal_wfamsh_id ON "tblVendorRenewal" (wfamsh_id)');
      await pool.query('CREATE INDEX idx_vendor_renewal_org_id ON "tblVendorRenewal" (org_id)');
      await pool.query('CREATE INDEX idx_vendor_renewal_renewal_date ON "tblVendorRenewal" (renewal_date)');
      log('✅ All 4 indexes created successfully!');
      log('');
      
      log('Step 5: Verifying...');
      const verify = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tblVendorRenewal' 
        ORDER BY ordinal_position
      `);
      
      log(`✅ Verification successful! Table has ${verify.rows.length} columns`);
    }
    
    log('');
    log('='.repeat(60));
    log('✅✅✅ SUCCESS! Table is ready to use! ✅✅✅');
    log('='.repeat(60));
    log('');
    log('The system will now automatically create vendor renewal records');
    log('when MT005 (Vendor Contract Renewal) workflows are approved.');
    log('');
    log('API Endpoint: GET http://localhost:5000/api/vendor-renewals');
    log('');
    
  } catch (error) {
    log('');
    log('❌ ERROR: ' + error.message);
    log('Stack: ' + error.stack);
  } finally {
    await pool.end();
    log('Database connection closed.');
    log('');
    log('Results saved to: table-status.txt');
  }
  
  process.exit(0);
})();
