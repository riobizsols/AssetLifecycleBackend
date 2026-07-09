require('dotenv').config();
const { initTenantRegistryPool, getTenantPool } = require('../services/tenantService');

(async () => {
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);
  const db = require('../config/db');
  db.query = (...args) => pool.query(...args);

  const { getUserNavigation } = require('../models/jobRoleNavModel');
  const nav = await getUserNavigation('USR002', 'D');

  const flat = (items, result = []) => {
    items.forEach((item) => {
      result.push(item);
      if (item.children?.length) flat(item.children, result);
    });
    return result;
  };

  console.log('Top-level:', nav.map((n) => `${n.label} (${n.app_id})`).join(', '));
  console.log('Has Dashboard:', flat(nav).some((i) => i.app_id === 'DASHBOARD'));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
