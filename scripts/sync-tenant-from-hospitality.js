#!/usr/bin/env node
/**
 * Align a tenant database schema to match hospitality (DATABASE_URL).
 * Usage: node scripts/sync-tenant-from-hospitality.js [tenant_db_name] [--seed]
 *
 * --seed  Also copy required master data (text messages, status codes, props, missing apps)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { alignTenantDatabase } = require('../services/tenantSchemaAlignService');

const args = process.argv.slice(2);
const dbName = args.find((a) => !a.startsWith('--')) || 'skasc_db';
const seedMasterData = args.includes('--seed');

alignTenantDatabase(dbName, { alignColumns: true, seedMasterData })
  .then((result) => {
    console.log('\n=== Alignment complete ===');
    console.log(JSON.stringify(result, null, 2));
    if (result.missingAfterAlign?.length) {
      console.warn('\nStill missing:', result.missingAfterAlign.join(', '));
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Alignment failed:', err.message);
    process.exit(1);
  });
