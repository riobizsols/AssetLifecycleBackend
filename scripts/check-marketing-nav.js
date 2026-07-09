require('dotenv').config();
const { initTenantRegistryPool, getTenantPool } = require('../services/tenantService');
const { getUserNavigation } = require('../models/jobRoleNavModel');

(async () => {
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);
  const db = require('../config/db');
  db.query = (...args) => pool.query(...args);

  const roles = await pool.query(`
    SELECT job_role_id, text FROM "tblJobRoles"
    WHERE text ILIKE '%marketing%'
  `);
  console.log('Marketing roles:', roles.rows);

  const jrId = roles.rows[0]?.job_role_id;
  if (!jrId) {
    console.log('No marketing role found');
    process.exit(0);
  }

  const navRows = await pool.query(`
    SELECT job_role_nav_id, parent_id, app_id, label, sequence, is_group, access_level
    FROM "tblJobRoleNav"
    WHERE job_role_id = $1 AND int_status = 1
    ORDER BY sequence, label
  `, [jrId]);

  console.log(`\n${jrId} nav rows:`);
  for (const r of navRows.rows) {
    console.log(`  ${r.sequence}\t${r.label}\t${r.app_id || ''}\tgroup=${r.is_group}\taccess=${r.access_level}`);
  }

  const sara = await pool.query(`
    SELECT u.user_id, u.email, u.full_name
    FROM "tblUsers" u
    WHERE u.email ILIKE '%sara%'
    LIMIT 5
  `);
  console.log('\nSara users:', sara.rows);

  if (sara.rows[0]) {
    const nav = await getUserNavigation(sara.rows[0].user_id, 'D');
    console.log('\nSara API nav top-level:');
    for (const item of nav) {
      const kids = (item.children || []).map((c) => `${c.label}(${c.app_id})`).join(', ');
      console.log(`  ${item.label} (${item.app_id || 'group'}) access=${item.access_level} children=[${kids}]`);
    }
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
