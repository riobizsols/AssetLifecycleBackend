/**
 * Create stock status notifications for NGP (PCB out of stock, Drive belts needs purchase, etc.)
 *
 * Usage: node scripts/ensure-stock-status-notifications.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { runWithDb } = require('../utils/dbContext');
const {
  ensureStockStatusNotificationsForOrg,
  listAlertParts,
} = require('../models/stockStatusNotifyModel');

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl('ngp_db'), ssl: false });
  try {
    await runWithDb(pool, async () => {
      const parts = await listAlertParts(pool, 'ORG003');
      console.log('Alert parts:', parts);

      const result = await ensureStockStatusNotificationsForOrg({ orgId: 'ORG003' });
      console.log('Ensure result:', JSON.stringify(result, null, 2));
    });
  } catch (err) {
    console.error('Failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
