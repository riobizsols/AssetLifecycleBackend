/**
 * Collapse duplicate stock alerts to one per part, then ensure current alerts.
 * Usage: node scripts/dedupe-stock-status-notifications.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { runWithDb } = require('../utils/dbContext');
const {
  dedupeOpenStockNotifications,
  ensureStockStatusNotificationsForOrg,
  getStockStatusNotificationsByUser,
} = require('../models/stockStatusNotifyModel');

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl('ngp_db'), ssl: false });
  try {
    await runWithDb(pool, async () => {
      const deduped = await dedupeOpenStockNotifications({ orgId: 'ORG003' });
      console.log('Dedupe:', deduped);
      const ensured = await ensureStockStatusNotificationsForOrg({ orgId: 'ORG003' });
      console.log('Ensure:', JSON.stringify(ensured, null, 2));
      const open = await getStockStatusNotificationsByUser({
        empIntId: 'EMP_ANY',
        orgId: 'ORG003',
        hasSuperAccess: true,
      });
      console.log(
        'Open alerts now:',
        open.map((r) => ({ id: r.notify_id, part: r.part_name, status: r.alert_status })),
      );
    });
  } catch (err) {
    console.error('Failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
