require('dotenv').config();
const { initTenantRegistryPool, getTenantPool } = require('../services/tenantService');

(async () => {
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);

  const r = await pool.query(`
    SELECT jrn.job_role_nav_id, jrn.parent_id, p.label AS parent_label,
           jrn.app_id, jrn.label, jrn.sequence
    FROM "tblJobRoleNav" jrn
    LEFT JOIN "tblJobRoleNav" p ON p.job_role_nav_id = jrn.parent_id
    WHERE jrn.job_role_id = 'JR001' AND jrn.int_status = 1
    ORDER BY jrn.sequence, jrn.label
  `);

  console.log('JR001 navigation:');
  for (const x of r.rows) {
    console.log(
      `${x.sequence}\t${x.parent_label || 'TOP'}\t${x.label}\t${x.app_id || ''}`,
    );
  }

  const hasUsers = r.rows.some((x) => x.app_id === 'USERS');
  console.log('\nHas USERS:', hasUsers);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
