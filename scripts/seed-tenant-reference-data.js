#!/usr/bin/env node
/**
 * Seed required master data from hospitality into a tenant database.
 * Usage: node scripts/seed-tenant-reference-data.js [tenant_db_name] [org_id]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { seedTenantDatabase } = require('../services/tenantReferenceDataService');

const dbName = process.argv[2] || 'skasc_db';
const orgId = process.argv[3] || null;

seedTenantDatabase(dbName, { orgId })
  .then((result) => {
    console.log('\n=== Seed complete ===');
    for (const r of result.results) {
      console.log(`  ${r.table}: +${r.inserted} inserted (${r.skippedRows || 0} already present)`);
    }
    console.log('\nReports:');
    console.log('  JSON:', result.reportPaths.jsonPath);
    console.log('  MD:  ', result.reportPaths.mdPath);
  })
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
