const { runWithDb } = require('../utils/dbContext');
const { runWithTenantContext } = require('../utils/tenantRequestContext');
const {
  TenantDbUnavailableError,
  getRequestHostname,
  resolveTenantDatabase,
} = require('../utils/tenantAuthResolver');

/**
 * Resolve tenant DB from subdomain (no JWT). For public routes that still need tbl* access.
 */
async function attachTenantDb(req, res, next) {
  try {
    const hostname = getRequestHostname(req);
    const resolved = await resolveTenantDatabase({ hostname });

    if (!resolved?.dbPool) {
      throw new TenantDbUnavailableError(`No active tenant database for host: ${hostname || 'unknown'}`);
    }

    req.db = resolved.dbPool;
    req.tenantPool = resolved.dbPool;
    req.isTenant = true;

    const tenantCtx = {
      registryOrgId: resolved.registryOrgId || null,
      subdomain: resolved.subdomain || null,
    };

    return runWithDb(resolved.dbPool, () => runWithTenantContext(tenantCtx, () => next()));
  } catch (error) {
    console.error('[attachTenantDb] Failed:', error.message);
    const status = error.code === 'TENANT_DB_UNAVAILABLE' ? 503 : 500;
    return res.status(status).json({
      success: false,
      message: 'Tenant database unavailable',
      error: error.message,
    });
  }
}

module.exports = { attachTenantDb };
