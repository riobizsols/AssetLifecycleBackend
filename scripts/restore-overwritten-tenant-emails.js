require('dotenv').config();
const { Pool } = require('pg');
const { buildPoolConfig } = require('../utils/pgSsl');
const { getTenantCredentials, initTenantRegistryPool } = require('../services/tenantService');

const OVERWRITTEN_ORIGINALS = [
  {
    email_normalized: 'aakashjaiswal0706@gmail.com',
    email_display: 'aakashjaiswal0706@gmail.com',
    org_id: 'HONDA',
    subdomain: 'honda',
    user_id: 'USR001',
    employee_id: 'EMP001',
    source: 'tenant_registration',
  },
  {
    email_normalized: 'niranjwn123@gmail.com',
    email_display: 'niranjwn123@gmail.com',
    org_id: 'GKNM',
    subdomain: 'gknm',
    user_id: 'USR002',
    employee_id: '1',
    source: 'backfill_employee',
  },
  {
    email_normalized: 'nivethakaliyappan@gmail.com',
    email_display: 'nivethakaliyappan@gmail.com',
    org_id: 'RIO',
    subdomain: 'rio-bizsols-1',
    user_id: 'USR002',
    employee_id: null,
    source: 'backfill_user',
  },
];

async function main() {
  initTenantRegistryPool();
  const registry = initTenantRegistryPool();

  const hospEmails = await registry.query(`
    SELECT email_normalized
    FROM tenant_user_emails
    WHERE source = 'backfill_hospitality' AND subdomain = 'hospitality'
  `);
  const hospSet = new Set(hospEmails.rows.map((r) => r.email_normalized));

  const tenants = await registry.query(`SELECT org_id, db_name, subdomain FROM tenants WHERE is_active = true`);
  const conflicts = [];

  for (const tenant of tenants.rows) {
    if (tenant.db_name === 'hospitality') continue;
    try {
      const creds = await getTenantCredentials(tenant.org_id);
      const pool = new Pool(buildPoolConfig({
        host: creds.host,
        port: creds.port,
        database: creds.database,
        user: creds.user,
        password: creds.password,
      }, { connectionTimeoutMillis: 15000 }));
      const users = await pool.query(`
        SELECT LOWER(TRIM(REPLACE(email, 'mailto:', ''))) AS email_normalized, user_id, org_id, emp_int_id
        FROM "tblUsers"
        WHERE email IS NOT NULL
      `);
      for (const user of users.rows) {
        if (!hospSet.has(user.email_normalized)) continue;
        const current = await registry.query(
          'SELECT org_id, subdomain, source FROM tenant_user_emails WHERE email_normalized = $1',
          [user.email_normalized]
        );
        if (current.rows[0]?.subdomain === 'hospitality') {
          conflicts.push({
            email: user.email_normalized,
            tenant_org: tenant.org_id,
            tenant_subdomain: tenant.subdomain,
            tenant_user_id: user.user_id,
            tenant_emp: user.emp_int_id,
            current: current.rows[0],
          });
        }
      }
      await pool.end();
    } catch (err) {
      console.warn(`Skip ${tenant.org_id}: ${err.message}`);
    }
  }

  console.log('Cross-tenant conflicts (hospitality backfill overwrote other tenant users):');
  console.log(JSON.stringify(conflicts, null, 2));

  let restored = 0;
  for (const row of OVERWRITTEN_ORIGINALS) {
    const result = await registry.query(
      `UPDATE tenant_user_emails
       SET email_display = $2, org_id = $3, subdomain = $4, user_id = $5, employee_id = $6, source = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE email_normalized = $1 AND subdomain = 'hospitality' AND source = 'backfill_hospitality'
       RETURNING email_normalized`,
      [row.email_normalized, row.email_display, row.org_id, row.subdomain, row.user_id, row.employee_id, row.source]
    );
    if (result.rowCount) {
      restored += 1;
      console.log('Restored:', row.email_normalized);
    }
  }

  // For any remaining conflicts found in tenant DBs, restore to that tenant
  for (const c of conflicts) {
    if (OVERWRITTEN_ORIGINALS.some((o) => o.email_normalized === c.email)) continue;
    const result = await registry.query(
      `UPDATE tenant_user_emails
       SET org_id = $2, subdomain = $3, user_id = $4, employee_id = $5, source = 'backfill_employee',
           updated_at = CURRENT_TIMESTAMP
       WHERE email_normalized = $1 AND subdomain = 'hospitality' AND source = 'backfill_hospitality'
       RETURNING email_normalized`,
      [c.email, c.tenant_org, c.tenant_subdomain, c.tenant_user_id, c.tenant_emp || null]
    );
    if (result.rowCount) {
      restored += 1;
      console.log('Restored from tenant DB:', c.email, '->', c.tenant_org);
    }
  }

  console.log(`\nTotal restored: ${restored}`);
  await registry.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
