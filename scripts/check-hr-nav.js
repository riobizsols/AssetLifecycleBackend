require('dotenv').config();
const { initTenantRegistryPool } = require('../services/tenantService');

(async () => {
  const { getTenantPool } = require('../services/tenantService');
  const { getCombinedNavigationStructure } = require('../models/jobRoleNavModel');

  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);
  const db = require('../config/db');
  db.query = (...args) => pool.query(...args);

  const nav = await getCombinedNavigationStructure(['JR002'], 'D');
  console.log('HR (JR002) top-level nav:');
  for (const item of nav) {
    const kids = (item.children || []).map((c) => c.label).join(', ');
    console.log(`  ${item.label} (${item.app_id}) group=${item.is_group} children=[${kids}]`);
  }

  const flat = await pool.query(`
    SELECT job_role_nav_id, parent_id, app_id, label, sequence, is_group, access_level
    FROM "tblJobRoleNav"
    WHERE job_role_id = 'JR002' AND int_status = 1
    ORDER BY sequence, label
  `);
  console.log('\nAll JR002 nav rows:');
  for (const r of flat.rows) {
    console.log(`  ${r.sequence}\t${r.job_role_nav_id}\tparent=${r.parent_id}\t${r.label}\tgroup=${r.is_group}\t${r.app_id}\taccess=${r.access_level}`);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
