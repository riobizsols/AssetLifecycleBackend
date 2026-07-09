require('dotenv').config();
const { initTenantRegistryPool } = require('../services/tenantService');

(async () => {
  const { getTenantPool } = require('../services/tenantService');
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);

  await pool.query(`
    UPDATE "tblJobRoleNav"
    SET label = 'Maintenance'
    WHERE job_role_id = 'JR002' AND label = 'Maintainance' AND is_group = true
  `);
  await pool.query(`
    UPDATE "tblJobRoleNav"
    SET label = 'Maintenance List'
    WHERE job_role_id = 'JR002' AND label = 'Maintainance List'
  `);

  const rows = await pool.query(`
    SELECT job_role_nav_id, label, app_id, is_group, access_level
    FROM "tblJobRoleNav"
    WHERE job_role_id = 'JR002' AND int_status = 1
    ORDER BY sequence
  `);
  console.log('Updated JR002 nav:');
  console.table(rows.rows);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
