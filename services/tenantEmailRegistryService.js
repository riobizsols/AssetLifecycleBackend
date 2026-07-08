const fs = require('fs');
const path = require('path');
const { initTenantRegistryPool } = require('./tenantService');
const { normalizeEmail } = require('../utils/tenantRequestContext');
const logger = require('../utils/logger');

let tenantUserEmailsTableReady = false;

async function getRegistryPool() {
  return initTenantRegistryPool();
}

async function ensureTenantUserEmailsTable(pool = null) {
  if (tenantUserEmailsTableReady) {
    return;
  }

  const registryPool = pool || await getRegistryPool();
  const sqlPath = path.join(__dirname, '../migrations/create_tenant_user_emails_table.sql');
  await registryPool.query(fs.readFileSync(sqlPath, 'utf8'));
  tenantUserEmailsTableReady = true;
  logger.log('[TenantEmailRegistry] tenant_user_emails table ready');
}

async function getSubdomainByOrgId(orgId) {
  if (!orgId) return null;
  const pool = await getRegistryPool();
  const result = await pool.query(
    `SELECT subdomain FROM "tenants"
     WHERE org_id = $1 AND is_active = true AND subdomain IS NOT NULL
     LIMIT 1`,
    [String(orgId).toUpperCase().trim()],
  );
  return result.rows[0]?.subdomain || null;
}

/**
 * Fast lookup for ALM app login: email -> { org_id, subdomain }
 */
async function getTenantFromEmail(email) {
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized || !emailNormalized.includes('@')) {
    return null;
  }

  const pool = await getRegistryPool();
  const result = await pool.query(
    `SELECT e.org_id, e.subdomain, t.is_active
     FROM "tenant_user_emails" e
     INNER JOIN "tenants" t ON t.org_id = e.org_id
     WHERE e.email_normalized = $1
       AND t.is_active = true
     LIMIT 1`,
    [emailNormalized],
  );

  if (!result.rows.length) {
    return null;
  }

  const row = result.rows[0];
  return {
    org_id: row.org_id,
    subdomain: row.subdomain,
  };
}

/**
 * Upsert email into universal registry.
 */
async function registerTenantEmail({
  email,
  orgId,
  subdomain,
  userId = null,
  employeeId = null,
  source = 'unknown',
}) {
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized || !emailNormalized.includes('@')) {
    return null;
  }

  const registryOrgId = String(orgId || '').toUpperCase().trim();
  if (!registryOrgId) {
    throw new Error('orgId is required to register tenant email');
  }

  let resolvedSubdomain = subdomain ? String(subdomain).trim().toLowerCase() : null;
  if (!resolvedSubdomain) {
    resolvedSubdomain = await getSubdomainByOrgId(registryOrgId);
  }
  if (!resolvedSubdomain) {
    throw new Error(`subdomain could not be resolved for org_id ${registryOrgId}`);
  }

  const pool = await getRegistryPool();
  await ensureTenantUserEmailsTable(pool);
  const result = await pool.query(
    `INSERT INTO "tenant_user_emails" (
      email_normalized, email_display, org_id, subdomain,
      user_id, employee_id, source, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    ON CONFLICT (email_normalized) DO UPDATE SET
      email_display = EXCLUDED.email_display,
      org_id = EXCLUDED.org_id,
      subdomain = EXCLUDED.subdomain,
      user_id = COALESCE(EXCLUDED.user_id, "tenant_user_emails".user_id),
      employee_id = COALESCE(EXCLUDED.employee_id, "tenant_user_emails".employee_id),
      source = EXCLUDED.source,
      updated_at = CURRENT_TIMESTAMP
    RETURNING email_normalized, org_id, subdomain`,
    [
      emailNormalized,
      String(email).trim(),
      registryOrgId,
      resolvedSubdomain,
      userId,
      employeeId,
      source,
    ],
  );

  return result.rows[0];
}

async function unregisterTenantEmail(email) {
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized) return 0;

  const pool = await getRegistryPool();
  const result = await pool.query(
    `DELETE FROM "tenant_user_emails" WHERE email_normalized = $1`,
    [emailNormalized],
  );
  return result.rowCount;
}

async function registerFromRequestContext({
  email,
  userId = null,
  employeeId = null,
  source = 'unknown',
  orgId = null,
  subdomain = null,
}) {
  const { getTenantContext } = require('../utils/tenantRequestContext');
  const ctx = getTenantContext() || {};
  const registryOrgId = orgId || ctx.registryOrgId;
  const resolvedSubdomain = subdomain || ctx.subdomain;

  if (!registryOrgId || !email) {
    return null;
  }

  try {
    return await registerTenantEmail({
      email,
      orgId: registryOrgId,
      subdomain: resolvedSubdomain,
      userId,
      employeeId,
      source,
    });
  } catch (err) {
    logger.warn(`[TenantEmailRegistry] register skipped (${source}): ${err.message}`);
    return null;
  }
}

async function registerManyFromRequestContext(entries = [], source = 'bulk') {
  const results = [];
  for (const entry of entries) {
    if (!entry?.email) continue;
    const row = await registerFromRequestContext({
      email: entry.email,
      userId: entry.userId || null,
      employeeId: entry.employeeId || null,
      source: entry.source || source,
      orgId: entry.orgId || null,
      subdomain: entry.subdomain || null,
    });
    if (row) results.push(row);
  }
  return results;
}

module.exports = {
  ensureTenantUserEmailsTable,
  getTenantFromEmail,
  getSubdomainByOrgId,
  registerTenantEmail,
  unregisterTenantEmail,
  registerFromRequestContext,
  registerManyFromRequestContext,
};
