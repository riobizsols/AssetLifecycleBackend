#!/usr/bin/env node
/**
 * Fix legacy bad IDs and sync tblIDSequences to match actual data.
 * Usage: node scripts/fix-tenant-id-formats.js [tenant_db_name]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { fixTenantDatabase } = require('../services/tenantIdFormatService');

const dbName = process.argv[2] || 'skasc_db';

fixTenantDatabase(dbName)
  .then((result) => {
    console.log('\n=== ID format fix complete ===');
    for (const r of result.remapLogs) {
      console.log(`  ${r.label}: ${r.status}`);
    }
    console.log(`  Invalid ID checks remaining: ${result.invalidCount}`);
    console.log('\nReports:');
    console.log('  JSON:', result.reportPaths.jsonPath);
    console.log('  MD:  ', result.reportPaths.mdPath);
    if (result.invalidCount > 0) process.exit(1);
  })
  .catch((err) => {
    console.error('Fix failed:', err.message);
    process.exit(1);
  });
