require('dotenv').config();
const { initTenantRegistryPool } = require('../services/tenantService');

(async () => {
  const { getTenantPool } = require('../services/tenantService');
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);

  const parents = await pool.query(`
    SELECT job_role_nav_id, parent_id, app_id, label, sequence, is_group
    FROM "tblJobRoleNav"
    WHERE job_role_id = 'JR001' AND int_status = 1
      AND (label ILIKE '%master data%' OR app_id = 'MASTERDATA')
    ORDER BY sequence
  `);
  console.log('Master Data parent rows:');
  console.table(parents.rows);

  for (const p of parents.rows) {
    const kids = await pool.query(`
      SELECT job_role_nav_id, parent_id, app_id, label, sequence, mob_desk
      FROM "tblJobRoleNav"
      WHERE job_role_id = 'JR001' AND int_status = 1 AND parent_id = $1
      ORDER BY sequence, label
    `, [p.job_role_nav_id]);
    console.log(`\nChildren of ${p.label} (${p.job_role_nav_id}):`, kids.rows.length);
    for (const k of kids.rows) {
      console.log(`  ${k.sequence}\t${k.app_id}\t${k.label}\tmob=${k.mob_desk}`);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
