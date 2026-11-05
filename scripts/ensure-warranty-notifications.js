/**
 * Create warranty expiry/expired notifications for one tenant (or all).
 *
 * Usage:
 *   node scripts/ensure-warranty-notifications.js manufacturing
 *   node scripts/ensure-warranty-notifications.js --all
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const {
  initTenantRegistryPool,
  getTenantPool,
} = require('../services/tenantService');
const { runWithDb } = require('../utils/dbContext');
const {
  ensureWarrantyNotificationsForWindowAllOrgs,
  ensureWarrantyNotificationsAcrossTenants,
} = require('../models/assetWarrantyNotifyModel');

async function resolveTenantOrgId(label) {
  const registry = initTenantRegistryPool();
  const res = await registry.query(
    `
      SELECT grouped_org_id AS org_id
      FROM "tenants"
      WHERE is_active = true
        AND (
          LOWER(grouped_org_id) = LOWER($1)
          OR LOWER(COALESCE(subdomain, '')) = LOWER($1)
          OR LOWER(db_name) = LOWER($1)
          OR LOWER(db_name) = LOWER($1 || '_db')
        )
      LIMIT 1
    `,
    [label]
  );
  return res.rows[0]?.org_id || null;
}

(async () => {
  const arg = String(process.argv[2] || '').trim();
  try {
    if (!arg || arg === '--all') {
      const result = await ensureWarrantyNotificationsAcrossTenants({ days: 10 });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const orgId = await resolveTenantOrgId(arg);
    if (!orgId) {
      throw new Error(`Tenant not found for "${arg}"`);
    }
    const pool = await getTenantPool(orgId);
    const result = await runWithDb(pool, () =>
      ensureWarrantyNotificationsForWindowAllOrgs({ days: 10 })
    );
    console.log(JSON.stringify({ tenant: orgId, ...result }, null, 2));
  } catch (err) {
    console.error('Failed:', err);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();
