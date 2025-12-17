/**
 * Migration script to create tblVendorRenewal table
 * Run this script once to set up the vendor renewal tracking functionality
 */

const { createVendorRenewalTable } = require('../models/vendorRenewalModel');

const runMigration = async () => {
  console.log('Starting migration: Create tblVendorRenewal table');
  console.log('================================================');
  
  try {
    const result = await createVendorRenewalTable();
    console.log('✅ Migration completed successfully');
    console.log(result.message);
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
