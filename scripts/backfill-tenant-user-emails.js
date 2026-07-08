/**
 * Backfill tenant_user_emails from all active tenant databases.
 * Usage: node scripts/backfill-tenant-user-emails.js
 */

require('dotenv').config();
const { initTenantRegistryPool, getTenantPool } = require('../services/tenantService');
const { registerTenantEmail } = require('../services/tenantEmailRegistryService');

async function fetchTenantSubdomain(pool, orgId) {
  const result = await pool.query(
    `SELECT subdomain FROM "tenants"
     WHERE org_id = $1 AND is_active = true AND subdomain IS NOT NULL
     LIMIT 1`,
    [String(orgId).toUpperCase()],
  );
  return result.rows[0]?.subdomain || null;
}

async function backfillTenant(orgId, subdomain) {
  const tenantPool = await getTenantPool(orgId);
  let registered = 0;
  let skipped = 0;

  const users = await tenantPool.query(
    `SELECT user_id, email, emp_int_id
     FROM "tblUsers"
     WHERE email IS NOT NULL AND TRIM(email) <> ''`,
  );

  for (const row of users.rows) {
    try {
      await registerTenantEmail({
        email: row.email,
        orgId,
        subdomain,
        userId: row.user_id,
        employeeId: row.emp_int_id || null,
        source: 'backfill_user',
      });
      registered += 1;
    } catch (err) {
      skipped += 1;
      console.warn(`[Backfill] skip user ${row.email}: ${err.message}`);
    }
  }

  const employees = await tenantPool.query(
    `SELECT emp_int_id, email_id
     FROM "tblEmployees"
     WHERE email_id IS NOT NULL AND TRIM(email_id) <> ''`,
  );

  for (const row of employees.rows) {
    try {
      await registerTenantEmail({
        email: row.email_id,
        orgId,
        subdomain,
        employeeId: row.emp_int_id,
        source: 'backfill_employee',
      });
      registered += 1;
    } catch (err) {
      skipped += 1;
      console.warn(`[Backfill] skip employee ${row.email_id}: ${err.message}`);
    }
  }

  return { registered, skipped };
}

async function main() {
  const registryPool = initTenantRegistryPool();
  const tenants = await registryPool.query(
    `SELECT org_id, subdomain FROM "tenants" WHERE is_active = true ORDER BY org_id`,
  );

  console.log(`Found ${tenants.rows.length} active tenant(s)`);
  let totalRegistered = 0;
  let totalSkipped = 0;

  for (const tenant of tenants.rows) {
    const orgId = String(tenant.org_id).toUpperCase();
    const subdomain = tenant.subdomain || await fetchTenantSubdomain(registryPool, orgId);
    if (!subdomain) {
      console.warn(`[Backfill] No subdomain for org_id ${orgId}, skipping`);
      continue;
    }

    console.log(`[Backfill] Processing tenant ${orgId} (${subdomain})...`);
    try {
      const { registered, skipped } = await backfillTenant(orgId, subdomain);
      totalRegistered += registered;
      totalSkipped += skipped;
      console.log(`[Backfill] ${orgId}: registered=${registered}, skipped=${skipped}`);
    } catch (err) {
      console.warn(`[Backfill] Failed for tenant ${orgId}: ${err.message}`);
    }
  }

  const count = await registryPool.query(`SELECT COUNT(*)::int AS n FROM "tenant_user_emails"`);
  console.log(`Done. New registrations: ${totalRegistered}, skipped: ${totalSkipped}, table total: ${count.rows[0].n}`);
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
