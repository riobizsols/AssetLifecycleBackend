/**
 * Subdomain Utility
 * 
 * Utilities for extracting subdomain from request and mapping to org_id
 */

// Use the same database connection as tenantService to access the tenants table
// This ensures we're querying the correct database where the tenants table exists
const { initTenantRegistryPool } = require('../services/tenantService');
const logger = require('./logger');

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
  
  // Remove port if present
  const hostWithoutPort = hostname.split(':')[0];
  logger.debug(`[SubdomainUtils] Extracting subdomain from: ${hostname} -> ${hostWithoutPort}`);
  
  // Split by dots
  const parts = hostWithoutPort.split('.');
  logger.debug(`[SubdomainUtils] Split parts:`, parts);
  
  // If we have at least 3 parts (subdomain.domain.tld), return the subdomain
  // For localhost or IP addresses, return null
  if (parts.length >= 3 && parts[0] !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostWithoutPort)) {
    const subdomain = parts[0].toLowerCase();
    logger.debug(`[SubdomainUtils] ✅ Extracted subdomain (3+ parts): ${subdomain}`);
    return subdomain;
  }
  
  // For development: check if hostname is localhost with subdomain pattern
  // e.g., orgname.localhost:3000 or rio.localhost:5173
  if (hostWithoutPort.includes('localhost') && parts.length >= 2 && parts[0] !== 'localhost') {
    const subdomain = parts[0].toLowerCase();
    logger.debug(`[SubdomainUtils] ✅ Extracted subdomain (localhost pattern): ${subdomain}`);
    return subdomain;
  }
  
  logger.debug(`[SubdomainUtils] ❌ No subdomain found`);
  return null;
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
  
  // Validate subdomain format (alphanumeric and hyphens only, max 63 chars)
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  if (!subdomainRegex.test(subdomain)) {
    logger.error(`[SubdomainUtils] ❌ Invalid subdomain format: ${subdomain}`);
    return null;
  }
  
  try {
    // Get the tenant registry pool (same connection used by tenantService)
    const pool = initTenantRegistryPool();
    
    if (!pool) {
      logger.error('[SubdomainUtils] ❌ Tenant registry pool not initialized');
      throw new Error('Database connection not available');
    }
    
    // Normalize subdomain (trim, lowercase)
    const normalizedSubdomain = subdomain.trim().toLowerCase();
    logger.debug(`[SubdomainUtils] 🔍 Looking up org_id for subdomain: "${subdomain}" (normalized: "${normalizedSubdomain}")`);
    
    // Query tenants table for subdomain mapping (case-insensitive, optimized)
    const tenantResult = await pool.query(
      `SELECT org_id, subdomain, is_active FROM "tenants" WHERE LOWER(TRIM(subdomain)) = $1 AND is_active = true LIMIT 1`,
      [normalizedSubdomain]
    );
    
    if (tenantResult.rows.length > 0) {
      const orgId = tenantResult.rows[0].org_id;
      logger.debug(`[SubdomainUtils] ✅ Found org_id in tenants table: ${orgId}`);
      return orgId;
    }
    
    // Fallback: check tblOrgs table for subdomain (use same pool)
    const orgResult = await pool.query(
      `SELECT org_id, subdomain FROM "tblOrgs" WHERE LOWER(TRIM(subdomain)) = $1 AND int_status = 1 LIMIT 1`,
      [normalizedSubdomain]
    );
    
    if (orgResult.rows.length > 0) {
      const orgId = orgResult.rows[0].org_id;
      logger.debug(`[SubdomainUtils] ✅ Found org_id in tblOrgs table: ${orgId}`);
      return orgId;
    }
    
    logger.debug(`[SubdomainUtils] ❌ No org_id found for subdomain: ${subdomain}`);
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
  
  // Convert to lowercase
  let subdomain = orgName.toLowerCase();
  
  // Remove special characters, keep only alphanumeric and hyphens
  subdomain = subdomain.replace(/[^a-z0-9-]/g, '-');
  
  // Remove multiple consecutive hyphens
  subdomain = subdomain.replace(/-+/g, '-');
  
  // Remove leading and trailing hyphens
  subdomain = subdomain.replace(/^-+|-+$/g, '');
  
  // Limit length to 63 characters (DNS subdomain limit)
  if (subdomain.length > 63) {
    subdomain = subdomain.substring(0, 63);
    subdomain = subdomain.replace(/-+$/, ''); // Remove trailing hyphen if cut
  }
  
  // Ensure it doesn't start with a number
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
    // Check tenants table
    let tenantQuery = `SELECT org_id FROM "tenants" WHERE subdomain = $1 AND is_active = true`;
    const tenantParams = [subdomain];
    
    if (excludeOrgId) {
      tenantQuery += ` AND org_id != $2`;
      tenantParams.push(excludeOrgId);
    }
    
    const tenantResult = await db.query(tenantQuery, tenantParams);
    
    if (tenantResult.rows.length > 0) {
      return false;
    }
    
    // Check tblOrgs table
    let orgQuery = `SELECT org_id FROM "tblOrgs" WHERE subdomain = $1 AND int_status = 1`;
    const orgParams = [subdomain];
    
    if (excludeOrgId) {
      orgQuery += ` AND org_id != $2`;
      orgParams.push(excludeOrgId);
    }
    
    const orgResult = await db.query(orgQuery, orgParams);
    
    return orgResult.rows.length === 0;
  } catch (error) {
    console.error('[SubdomainUtils] Error checking subdomain availability:', error);
    return false;
  }
}

/**
 * Generate unique subdomain from org name
 * @param {string} orgName - The organization name
 * @returns {Promise<string>} - A unique subdomain
 */
async function generateUniqueSubdomain(orgName) {
  let baseSubdomain = generateSubdomain(orgName);
  
  if (!baseSubdomain) {
    baseSubdomain = 'org-' + Math.random().toString(36).substring(2, 8);
  }
  
  let subdomain = baseSubdomain;
  let counter = 1;
  
  // Keep trying until we find an available subdomain
  try {
    const isAvailable = await isSubdomainAvailable(subdomain);
    
    if (isAvailable) {
      // Base subdomain is available, use it without any suffix
      return subdomain;
    }
    
    // Base subdomain is taken, try with counter suffix
    while (counter <= 100) {
      subdomain = `${baseSubdomain}-${counter}`;
      
      if (await isSubdomainAvailable(subdomain)) {
        return subdomain;
      }
      
      counter++;
    }
    
    // If we still can't find one after 100 tries, throw error
    throw new Error(`Unable to generate unique subdomain for "${orgName}" after 100 attempts`);
  } catch (error) {
    console.error('[SubdomainUtils] Error generating unique subdomain:', error.message);
    // If there's an error checking availability, return base subdomain and log warning
    console.warn('[SubdomainUtils] ⚠️ Could not verify subdomain availability. Using base subdomain: ' + baseSubdomain);
    return baseSubdomain;
  }
}

module.exports = {
  extractSubdomain,
  getOrgIdFromSubdomain,
  generateSubdomain,
  isSubdomainAvailable,
  generateUniqueSubdomain,
};

