const { getOrgIdFromSubdomain, extractTenantSubdomain } = require('./subdomainUtils');
const { getTenantPool, checkTenantExists } = require('../services/tenantService');
const { getTenantFromEmail, getSubdomainByOrgId } = require('../services/tenantEmailRegistryService');

class TenantDbUnavailableError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TenantDbUnavailableError';
        this.code = 'TENANT_DB_UNAVAILABLE';
    }
}

function getRequestHostname(req) {
    return req.get('host') || req.get('x-forwarded-host') || req.hostname || req.headers.host;
}

async function resolveTenantPoolByOrgId(orgId) {
    const normalizedOrgId = String(orgId || '').toUpperCase().trim();
    if (!normalizedOrgId) {
        return null;
    }

    const tenantExists = await checkTenantExists(normalizedOrgId);
    if (!tenantExists) {
        return null;
    }

    const resolvedSubdomain = await getSubdomainByOrgId(normalizedOrgId);
    return {
        dbPool: await getTenantPool(normalizedOrgId),
        registryOrgId: normalizedOrgId,
        subdomain: resolvedSubdomain,
    };
}

/**
 * Resolve tenant database from subdomain, registry org_id, and/or email.
 * Never falls back to DATABASE_URL / default application database.
 */
async function resolveTenantDatabase({ hostname, email = null, orgId = null }) {
    const subdomain = extractTenantSubdomain(hostname);
    let registryOrgId = orgId ? String(orgId).toUpperCase().trim() : null;
    let resolvedSubdomain = subdomain;

    if (subdomain) {
        const subdomainOrgId = await getOrgIdFromSubdomain(subdomain);
        if (subdomainOrgId) {
            registryOrgId = subdomainOrgId;
        }
    }

    if (!registryOrgId && email) {
        const emailMapping = await getTenantFromEmail(email);
        if (emailMapping?.org_id) {
            registryOrgId = emailMapping.org_id;
            resolvedSubdomain = emailMapping.subdomain || resolvedSubdomain;
        }
    }

    if (!registryOrgId) {
        return null;
    }

    const resolved = await resolveTenantPoolByOrgId(registryOrgId);
    if (!resolved) {
        return null;
    }

    return {
        ...resolved,
        subdomain: resolvedSubdomain || resolved.subdomain,
    };
}

/**
 * Same as resolveTenantDatabase but throws when tenant cannot be resolved.
 */
async function requireTenantDatabase(options) {
    const resolved = await resolveTenantDatabase(options);
    if (!resolved) {
        throw new TenantDbUnavailableError('Tenant database could not be resolved for this request');
    }
    return resolved;
}

module.exports = {
    TenantDbUnavailableError,
    getRequestHostname,
    resolveTenantPoolByOrgId,
    resolveTenantDatabase,
    requireTenantDatabase,
};
