const db = require('./config/db');

console.log('Checking if tblVendorRenewal exists...');

db.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'tblVendorRenewal'
`, (err, result) => {
  if (err) {
    console.log('❌ Error:', err.message);
  } else if (result.rows.length > 0) {
    console.log('✅ Table EXISTS: tblVendorRenewal');
  } else {
    console.log('❌ Table DOES NOT EXIST: tblVendorRenewal');
    console.log('\nPlease run this SQL in your database client:');
    console.log(`
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

CREATE INDEX idx_vendor_renewal_vendor_id ON "tblVendorRenewal" (vendor_id);
CREATE INDEX idx_vendor_renewal_wfamsh_id ON "tblVendorRenewal" (wfamsh_id);
CREATE INDEX idx_vendor_renewal_org_id ON "tblVendorRenewal" (org_id);
CREATE INDEX idx_vendor_renewal_renewal_date ON "tblVendorRenewal" (renewal_date);
    `);
  }
  
  db.end();
  process.exit(0);
});
