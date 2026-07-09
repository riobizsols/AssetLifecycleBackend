require('dotenv').config();
const { initTenantRegistryPool } = require('../services/tenantService');

async function getTenantBySubdomain(subdomain) {
  const pool = initTenantRegistryPool();
  const q = await pool.query(
    `SELECT org_id, subdomain, db_name, db_host, db_port, db_user
     FROM "tenants"
     WHERE LOWER(TRIM(subdomain)) = LOWER($1) AND is_active = true
     LIMIT 1`,
    [subdomain],
  );
  return q.rows[0];
}

(async () => {
  const { getTenantPool } = require('../services/tenantService');
  const tenant = await getTenantBySubdomain('kia');
  if (!tenant) {
    console.log('No tenant found for subdomain: kia');
    process.exit(0);
  }
  console.log('Tenant:', tenant.org_id, tenant.db_name);
  const pool = await getTenantPool(tenant.org_id);
  const q = await pool.query(`
    SELECT job_role_nav_id, parent_id, app_id, label, sequence, access_level, int_status
    FROM "tblJobRoleNav"
    WHERE job_role_id = 'JR001' AND int_status = 1
      AND (parent_id IN (
        SELECT job_role_nav_id FROM "tblJobRoleNav"
        WHERE job_role_id = 'JR001' AND label ILIKE 'master data' AND int_status = 1
      ) OR app_id IN ('USERS', 'USERROLES'))
    ORDER BY sequence, label
  `);
  console.log('KIA tenant Master Data children / role items:');
  for (const r of q.rows) {
    console.log(`${r.sequence}\t${r.app_id}\t${r.label}\tparent=${r.parent_id}\taccess=${r.access_level}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
