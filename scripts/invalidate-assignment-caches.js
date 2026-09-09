#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const assetsDashboardCache = require('../utils/assetsDashboardCache');

(async () => {
  for (const orgId of ['BAN001', 'BAN002', 'BAN003', 'BAN004', 'BAN005']) {
    await assetsDashboardCache.invalidateOrgApiCache(orgId);
    console.log('Invalidated cache for', orgId);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
