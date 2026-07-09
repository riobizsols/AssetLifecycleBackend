require('dotenv').config();
const { initTenantRegistryPool } = require('../services/tenantService');

(async () => {
  const { getTenantPool } = require('../services/tenantService');
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);

  const users = await pool.query(`
    SELECT u.user_id, u.emp_int_id, u.full_name, u.email, u.int_status, u.job_role_id,
           jr.text AS job_role_name, u.created_on, u.changed_on
    FROM "tblUsers" u
    LEFT JOIN "tblJobRoles" jr ON jr.job_role_id = u.job_role_id
    WHERE u.emp_int_id = 'EMP_INT_0054' OR u.email ILIKE '%babu%'
    ORDER BY u.created_on NULLS LAST, u.user_id
  `);
  console.log('All Babu-related users:');
  console.table(users.rows);

  const roles = await pool.query(`
    SELECT ujr.user_job_role_id, ujr.user_id, ujr.job_role_id, jr.text
    FROM "tblUserJobRoles" ujr
    JOIN "tblJobRoles" jr ON jr.job_role_id = ujr.job_role_id
  WHERE ujr.user_id IN (SELECT user_id FROM "tblUsers" WHERE emp_int_id = 'EMP_INT_0054')
  `);
  console.log('\ntblUserJobRoles for Babu users:');
  console.table(roles.rows);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
