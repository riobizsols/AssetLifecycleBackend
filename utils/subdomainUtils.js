/**
 * Subdomain Utility
 *
 * Utilities for extracting subdomain from request and mapping to org_id
 */

const db = require('../config/db');
const { initTenantRegistryPool } = require('../services/tenantService');
const logger = require('./logger');

const RESERVED_SUBDOMAINS = (process.env.RESERVED_SUBDOMAINS || 'web,www,api')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/**
 * Extract subdomain from request hostname
 * @param {string} hostname - The request hostname (e.g., "orgname.example.com")
 * @returns {string|null} - The subdomain or null if not found
 */
function extractSubdomain(hostname) {
  if (!hostname) {
    logger.debug('[SubdomainUtils] No hostname provided');
    return null;
  }

  const hostWithoutPort = hostname.split(':')[0];
  logger.debug(`[SubdomainUtils] Extracting subdomain from: ${hostname} -> ${hostWithoutPort}`);

  const parts = hostWithoutPort.split('.');
  logger.debug('[SubdomainUtils] Split parts:', parts);

  if (parts.length >= 3 && parts[0] !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostWithoutPort)) {
    const subdomain = parts[0].toLowerCase();
    logger.debug(`[SubdomainUtils] Extracted subdomain (3+ parts): ${subdomain}`);
    return subdomain;
  }

  if (hostWithoutPort.includes('localhost') && parts.length >= 2 && parts[0] !== 'localhost') {
    const subdomain = parts[0].toLowerCase();
    logger.debug(`[SubdomainUtils] Extracted subdomain (localhost pattern): ${subdomain}`);
    return subdomain;
  }

  logger.debug('[SubdomainUtils] No subdomain found');
  return null;
}

function isReservedSubdomain(subdomain) {
  if (!subdomain) return false;
  return RESERVED_SUBDOMAINS.includes(String(subdomain).trim().toLowerCase());
}

/**
 * Subdomain for tenant routing — ignores reserved hosts like web/www/api.
 */
function extractTenantSubdomain(hostname) {
  const subdomain = extractSubdomain(hostname);
  if (!subdomain || isReservedSubdomain(subdomain)) {
    return null;
  }
  return subdomain;
}

/**
 * Get org_id from subdomain
 * @param {string} subdomain - The subdomain
 * @returns {Promise<string|null>} - The org_id or null if not found
 */
async function getOrgIdFromSubdomain(subdomain) {
  if (!subdomain) {
    logger.debug('[SubdomainUtils] No subdomain provided for org_id lookup');
    return null;
  }

  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!subdomainRegex.test(subdomain)) {
    logger.error(`[SubdomainUtils] Invalid subdomain format: ${subdomain}`);
    return null;
  }

  try {
    const pool = initTenantRegistryPool();
    if (!pool) {
      logger.error('[SubdomainUtils] Tenant registry pool not initialized');
      throw new Error('Database connection not available');
    }

    const normalizedSubdomain = subdomain.trim().toLowerCase();
    logger.debug(`[SubdomainUtils] Looking up org_id for subdomain: "${subdomain}" (normalized: "${normalizedSubdomain}")`);

    const tenantResult = await pool.query(
      `SELECT org_id, subdomain, is_active FROM "tenants" WHERE LOWER(TRIM(subdomain)) = $1 AND is_active = true LIMIT 1`,
      [normalizedSubdomain]
    );

    if (tenantResult.rows.length > 0) {
      const orgId = tenantResult.rows[0].org_id;
      logger.debug(`[SubdomainUtils] Found org_id in tenants table: ${orgId}`);
      return orgId;
    }

    logger.debug(`[SubdomainUtils] No org_id found for subdomain: ${subdomain}`);
    return null;
  } catch (error) {
    logger.error('[SubdomainUtils] Error getting org_id from subdomain:', error);
    logger.error('[SubdomainUtils] Error stack:', error.stack);
    return null;
  }
}

/**
 * Generate a valid subdomain from organization name
 * @param {string} orgName - The organization name
 * @returns {string} - A valid subdomain
 */
function generateSubdomain(orgName) {
  if (!orgName) return null;

  let subdomain = orgName.toLowerCase();
  subdomain = subdomain.replace(/[^a-z0-9-]/g, '-');
  subdomain = subdomain.replace(/-+/g, '-');
  subdomain = subdomain.replace(/^-+|-+$/g, '');

  if (subdomain.length > 63) {
    subdomain = subdomain.substring(0, 63);
    subdomain = subdomain.replace(/-+$/, '');
  }

  if (/^\d/.test(subdomain)) {
    subdomain = 'org-' + subdomain;
  }

  return subdomain;
}

/**
 * Check if subdomain is available
 * @param {string} subdomain - The subdomain to check
 * @param {string} excludeOrgId - Optional org_id to exclude from check (for updates)
 * @returns {Promise<boolean>} - True if available, false if taken
 */
async function isSubdomainAvailable(subdomain, excludeOrgId = null) {
  if (!subdomain) return false;

  try {
    const pool = initTenantRegistryPool();
    if (!pool) {
      logger.error('[SubdomainUtils] Tenant registry pool not initialized');
      throw new Error('Database connection not available');
    }

    const normalizedSubdomain = subdomain.trim().toLowerCase();

    let tenantQuery = `SELECT org_id FROM "tenants" WHERE LOWER(TRIM(subdomain)) = $1 AND is_active = true`;
    const tenantParams = [normalizedSubdomain];

    if (excludeOrgId) {
      tenantQuery += ' AND org_id != $2';
      tenantParams.push(excludeOrgId);
    }

    const tenantResult = await pool.query(tenantQuery, tenantParams);
    if (tenantResult.rows.length > 0) {
      return false;
    }

    try {
      let orgQuery = `SELECT org_id FROM "tblOrgs" WHERE LOWER(TRIM(subdomain)) = $1 AND int_status = 1`;
      const orgParams = [normalizedSubdomain];

      if (excludeOrgId) {
        orgQuery += ' AND org_id != $2';
        orgParams.push(excludeOrgId);
      }

      const orgResult = await db.query(orgQuery, orgParams);
      return orgResult.rows.length === 0;
    } catch (orgError) {
      if (orgError.code === '42703' || orgError.code === '42P01') {
        return true;
      }
      throw orgError;
    }
  } catch (error) {
    logger.error('[SubdomainUtils] Error checking subdomain availability:', error);
    throw error;
  }
}

/**
 * Validate and normalize a user-provided subdomain.
 * @returns {string} normalized subdomain
 */
function validateSubdomain(subdomain) {
  if (!subdomain || typeof subdomain !== 'string') {
    throw new Error('Sub-domain name is required');
  }

  const normalized = subdomain.trim().toLowerCase();

  if (normalized.length < 3) {
    throw new Error('Sub-domain name must be at least 3 characters');
  }

  if (normalized.length > 63) {
    throw new Error('Sub-domain name must be 63 characters or less');
  }

  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!subdomainRegex.test(normalized)) {
    throw new Error('Sub-domain name must use lowercase letters, numbers, and hyphens only');
  }

  if (RESERVED_SUBDOMAINS.includes(normalized)) {
    throw new Error(`Sub-domain name "${normalized}" is reserved`);
  }

  return normalized;
}

async function generateUniqueSubdomain(orgName) {
  let baseSubdomain = generateSubdomain(orgName);

  if (!baseSubdomain) {
    baseSubdomain = 'org-' + Math.random().toString(36).substring(2, 8);
  }

  let subdomain = baseSubdomain;
  let counter = 1;

  const isAvailable = await isSubdomainAvailable(subdomain);
  if (isAvailable) {
    return subdomain;
  }

  while (counter <= 100) {
    subdomain = `${baseSubdomain}-${counter}`;
    if (await isSubdomainAvailable(subdomain)) {
      return subdomain;
    }
    counter++;
  }

  throw new Error(`Unable to generate unique subdomain for "${orgName}" after 100 attempts`);
}

module.exports = {
  extractSubdomain,
  extractTenantSubdomain,
  isReservedSubdomain,
  getOrgIdFromSubdomain,
  generateSubdomain,
  validateSubdomain,
  isSubdomainAvailable,
  generateUniqueSubdomain,
};
