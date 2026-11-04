const { initTenantRegistryPool } = require('./tenantService');
const { normalizeWhatsAppPhone } = require('../utils/whatsappPhone');
const logger = require('../utils/logger');

let tableReady = false;

const TENANT_USER_WHATSAPP_DDL = `
CREATE TABLE IF NOT EXISTS "tenant_user_whatsapp" (
    phone_normalized character varying(20) PRIMARY KEY,
    org_id character varying(10) NOT NULL,
    subdomain character varying(63) NOT NULL,
    user_id character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_user_whatsapp_org_id
    ON "tenant_user_whatsapp"(org_id);
CREATE INDEX IF NOT EXISTS idx_tenant_user_whatsapp_user_id
    ON "tenant_user_whatsapp"(user_id);
`;

async function getRegistryPool() {
  return initTenantRegistryPool();
}

async function ensureTenantUserWhatsAppTable(pool = null) {
  if (tableReady) return;
  const registryPool = pool || await getRegistryPool();
  await registryPool.query(TENANT_USER_WHATSAPP_DDL);
  tableReady = true;
  logger.log('[TenantWhatsAppRegistry] tenant_user_whatsapp table ready');
}

async function getSubdomainByOrgId(orgId) {
  if (!orgId) return null;
  const pool = await getRegistryPool();
  const result = await pool.query(
    `SELECT subdomain FROM "tenants"
     WHERE grouped_org_id = $1 AND is_active = true AND subdomain IS NOT NULL
     LIMIT 1`,
    [String(orgId).toUpperCase().trim()],
  );
  return result.rows[0]?.subdomain || null;
}

async function getTenantFromWhatsAppPhone(phone) {
  const phoneNormalized = normalizeWhatsAppPhone(phone);
  if (!phoneNormalized) return null;

  try {
    const pool = await getRegistryPool();
    await ensureTenantUserWhatsAppTable(pool);
    const result = await pool.query(
      `SELECT w.org_id, w.subdomain, w.user_id, t.is_active
       FROM "tenant_user_whatsapp" w
       INNER JOIN "tenants" t ON t.grouped_org_id = w.org_id
       WHERE w.phone_normalized = $1
         AND t.is_active = true
       LIMIT 1`,
      [phoneNormalized],
    );
    if (!result.rows.length) return null;
    return {
      org_id: result.rows[0].org_id,
      subdomain: result.rows[0].subdomain,
      user_id: result.rows[0].user_id,
    };
  } catch (err) {
    if (err?.code === '42P01') {
      logger.warn('[TenantWhatsAppRegistry] tenant_user_whatsapp table missing');
      return null;
    }
    throw err;
  }
}

async function registerTenantWhatsApp({ phone, orgId, subdomain, userId = null }) {
  const phoneNormalized = normalizeWhatsAppPhone(phone);
  if (!phoneNormalized) return null;

  const registryOrgId = String(orgId || '').toUpperCase().trim();
  if (!registryOrgId) {
    throw new Error('orgId is required to register WhatsApp number');
  }

  let resolvedSubdomain = subdomain ? String(subdomain).trim().toLowerCase() : null;
  if (!resolvedSubdomain) {
    resolvedSubdomain = await getSubdomainByOrgId(registryOrgId);
  }
  if (!resolvedSubdomain) {
    throw new Error(`subdomain could not be resolved for org_id ${registryOrgId}`);
  }

  const pool = await getRegistryPool();
  await ensureTenantUserWhatsAppTable(pool);
  const result = await pool.query(
    `INSERT INTO "tenant_user_whatsapp" (
      phone_normalized, org_id, subdomain, user_id, updated_at
    ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (phone_normalized) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      subdomain = EXCLUDED.subdomain,
      user_id = COALESCE(EXCLUDED.user_id, "tenant_user_whatsapp".user_id),
      updated_at = CURRENT_TIMESTAMP
    RETURNING phone_normalized, org_id, subdomain, user_id`,
    [phoneNormalized, registryOrgId, resolvedSubdomain, userId],
  );
  return result.rows[0];
}

async function unregisterTenantWhatsApp({ phone, userId = null, orgId = null }) {
  const pool = await getRegistryPool();
  await ensureTenantUserWhatsAppTable(pool);
  if (phone) {
    const phoneNormalized = normalizeWhatsAppPhone(phone);
    if (!phoneNormalized) return 0;
    const result = await pool.query(
      `DELETE FROM "tenant_user_whatsapp" WHERE phone_normalized = $1`,
      [phoneNormalized],
    );
    return result.rowCount;
  }
  if (userId && orgId) {
    const result = await pool.query(
      `DELETE FROM "tenant_user_whatsapp" WHERE user_id = $1 AND org_id = $2`,
      [userId, String(orgId).toUpperCase().trim()],
    );
    return result.rowCount;
  }
  return 0;
}

async function registerFromRequestContext({ phone, userId = null, orgId = null, subdomain = null }) {
  const { getTenantContext } = require('../utils/tenantRequestContext');
  const ctx = getTenantContext() || {};
  const registryOrgId = orgId || ctx.registryOrgId;
  const resolvedSubdomain = subdomain || ctx.subdomain;
  if (!registryOrgId || !phone) return null;
  try {
    return await registerTenantWhatsApp({
      phone,
      orgId: registryOrgId,
      subdomain: resolvedSubdomain,
      userId,
    });
  } catch (err) {
    logger.warn(`[TenantWhatsAppRegistry] register skipped: ${err.message}`);
    return null;
  }
}

module.exports = {
  ensureTenantUserWhatsAppTable,
  getTenantFromWhatsAppPhone,
  registerTenantWhatsApp,
  unregisterTenantWhatsApp,
  registerFromRequestContext,
};
