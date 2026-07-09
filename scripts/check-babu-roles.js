require('dotenv').config();
const { initTenantRegistryPool } = require('../services/tenantService');

(async () => {
  const { getTenantPool } = require('../services/tenantService');
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);

  const emp = await pool.query(
    `SELECT emp_int_id, employee_id, name FROM "tblEmployees" WHERE name ILIKE 'babu%' OR employee_id ILIKE '%babu%' LIMIT 5`,
  );
  console.log('Babu employees:', emp.rows);

  for (const e of emp.rows) {
    const users = await pool.query(
      `SELECT user_id, emp_int_id, int_status, job_role_id FROM "tblUsers" WHERE emp_int_id = $1`,
      [e.emp_int_id],
    );
    console.log('\nUsers for', e.employee_id, users.rows);

    for (const u of users.rows) {
      const roles = await pool.query(
        `SELECT ujr.*, jr.text FROM "tblUserJobRoles" ujr JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id WHERE ujr.user_id = $1`,
        [u.user_id],
      );
      console.log('Roles:', roles.rows);
    }
  }

  const marketing = await pool.query(
    `SELECT job_role_id, text FROM "tblJobRoles" WHERE text ILIKE '%market%'`,
  );
  console.log('\nMarketing roles:', marketing.rows);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
