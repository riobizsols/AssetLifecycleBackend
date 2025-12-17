/**
 * Standalone migration script to create tblVendorRenewal table
 * This script connects directly to the database without dependencies
 */

const { Pool } = require('pg');
require('dotenv').config();

const runMigration = async () => {
  console.log('Starting migration: Create tblVendorRenewal table');
  console.log('================================================');
  
  // Create database pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('Connecting to database...');
    
    const createTableQuery = `
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
        changed_on TIMESTAMP,
        CONSTRAINT fk_vendor 
          FOREIGN KEY (vendor_id) 
          REFERENCES "tblVendors" (vendor_id) 
          ON DELETE CASCADE,
        CONSTRAINT fk_workflow 
          FOREIGN KEY (wfamsh_id) 
          REFERENCES "tblWFAssetMaintSch_H" (wfamsh_id) 
          ON DELETE CASCADE
      );
    `;
    
    console.log('Creating table tblVendorRenewal...');
    await pool.query(createTableQuery);
    console.log('✅ Table created successfully!');
    
    // Create indexes
    console.log('Creating indexes...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_renewal_vendor_id 
      ON "tblVendorRenewal" (vendor_id);
    `);
    console.log('✅ Index created: idx_vendor_renewal_vendor_id');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_renewal_wfamsh_id 
      ON "tblVendorRenewal" (wfamsh_id);
    `);
    console.log('✅ Index created: idx_vendor_renewal_wfamsh_id');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_renewal_org_id 
      ON "tblVendorRenewal" (org_id);
    `);
    console.log('✅ Index created: idx_vendor_renewal_org_id');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_vendor_renewal_renewal_date 
      ON "tblVendorRenewal" (renewal_date);
    `);
    console.log('✅ Index created: idx_vendor_renewal_renewal_date');
    
    // Verify table exists
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'tblVendorRenewal';
    `;
    const verifyResult = await pool.query(verifyQuery);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n✅ Verification successful: tblVendorRenewal table exists');
    } else {
      console.log('\n❌ Verification failed: Table not found');
    }
    
    console.log('\n================================================');
    console.log('✅ Migration completed successfully!');
    console.log('================================================\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error('Error:', error.message);
    
    if (error.code === '23503') {
      console.error('\nForeign key constraint error. Make sure these tables exist:');
      console.error('  - tblVendors');
      console.error('  - tblWFAssetMaintSch_H');
    } else if (error.code === '42P07') {
      console.log('\n✅ Table already exists. Migration skipped.');
      process.exit(0);
    }
    
    await pool.end();
    process.exit(1);
  }
};

// Run migration
runMigration();
