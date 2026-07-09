require('dotenv').config();
const { initTenantRegistryPool } = require('../services/tenantService');

(async () => {
  const { getTenantPool } = require('../services/tenantService');
  const registry = initTenantRegistryPool();
  const t = await registry.query(
    `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = 'kia' AND is_active = true LIMIT 1`,
  );
  const pool = await getTenantPool(t.rows[0].org_id);

  const q = await pool.query(`
    SELECT 
        e.employee_id, e.name,
        account.user_id,
        COALESCE(account.primary_job_role_id, account.legacy_job_role_id) AS job_role_id,
        COALESCE(account.job_role_names, account.legacy_job_role_name) AS job_role_name
    FROM "tblEmployees" e
    LEFT JOIN LATERAL (
        SELECT
            (ARRAY_AGG(u.user_id ORDER BY u.int_status DESC, u.changed_on DESC NULLS LAST, u.user_id DESC))[1] AS user_id,
            (ARRAY_AGG(jr.job_role_id ORDER BY ujr.user_job_role_id DESC)
                FILTER (WHERE jr.job_role_id IS NOT NULL))[1] AS primary_job_role_id,
            NULLIF(
                STRING_AGG(DISTINCT jr.text, ', ' ORDER BY jr.text)
                    FILTER (WHERE jr.text IS NOT NULL),
                ''
            ) AS job_role_names,
            (ARRAY_AGG(u.job_role_id ORDER BY u.int_status DESC, u.changed_on DESC NULLS LAST)
                FILTER (WHERE u.job_role_id IS NOT NULL))[1] AS legacy_job_role_id,
            (ARRAY_AGG(jr_legacy.text ORDER BY u.int_status DESC, u.changed_on DESC NULLS LAST)
                FILTER (WHERE jr_legacy.text IS NOT NULL))[1] AS legacy_job_role_name
        FROM "tblUsers" u
        LEFT JOIN "tblUserJobRoles" ujr ON ujr.user_id = u.user_id
        LEFT JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
        LEFT JOIN "tblJobRoles" jr_legacy ON u.job_role_id = jr_legacy.job_role_id
        WHERE u.emp_int_id = e.emp_int_id
    ) account ON true
    WHERE e.name ILIKE 'babu%'
  `);
  console.table(q.rows);

  const oldQ = await pool.query(`
    SELECT e.employee_id, u.user_id, u.int_status, u.job_role_id, jr.text as job_role_name
    FROM "tblEmployees" e
    LEFT JOIN "tblUsers" u ON e.emp_int_id = u.emp_int_id AND u.int_status = 1
    LEFT JOIN "tblJobRoles" jr ON u.job_role_id = jr.job_role_id
    WHERE e.name ILIKE 'babu%'
  `);
  console.log('Old-style rows:', oldQ.rows.length);
  console.table(oldQ.rows);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
