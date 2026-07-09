require('dotenv').config();
const { initTenantRegistryPool, getTenantPool } = require('../services/tenantService');

(async () => {
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);

  const result = await pool.query(`
    UPDATE "tblJobRoleNav"
    SET label = 'Users'
    WHERE app_id = 'USERS'
      AND int_status = 1
      AND label <> 'Users'
    RETURNING job_role_nav_id, job_role_id, label
  `);

  console.log(`Updated ${result.rowCount} navigation row(s) to label "Users":`);
  for (const row of result.rows) {
    console.log(`  ${row.job_role_nav_id} (${row.job_role_id}) -> ${row.label}`);
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
