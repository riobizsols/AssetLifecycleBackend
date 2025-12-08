const { Pool } = require('pg');
require('dotenv').config();

console.log('=== VENDOR RENEWAL TABLE CREATION ===');
console.log('Starting...\n');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const createTable = async () => {
  try {
    console.log('1. Connecting to database...');
    
    // Test connection
    const testResult = await pool.query('SELECT NOW()');
    console.log('✅ Connected at:', testResult.rows[0].now);
    
    console.log('\n2. Creating table tblVendorRenewal...');
    
    const createSQL = `
      CREATE TABLE IF NOT EXISTS "tblVendorRenewal" (
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
    `;
    
    await pool.query(createSQL);
    console.log('✅ Table created/verified');
    
    console.log('\n3. Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_vendor_renewal_vendor_id ON "tblVendorRenewal" (vendor_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_vendor_renewal_wfamsh_id ON "tblVendorRenewal" (wfamsh_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_vendor_renewal_org_id ON "tblVendorRenewal" (org_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_vendor_renewal_renewal_date ON "tblVendorRenewal" (renewal_date)');
    console.log('✅ Indexes created');
    
    console.log('\n4. Verifying table exists...');
    const verify = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'tblVendorRenewal' 
      ORDER BY ordinal_position
    `);
    
    console.log(`✅ Table verified with ${verify.rows.length} columns:`);
    verify.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    console.log('\n=== SUCCESS! ===');
    console.log('tblVendorRenewal table is ready to use!');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
    console.log('\nDatabase connection closed.');
  }
};

createTable();
