/**
 * Organization ID Helper
 * 
 * This helper ensures that we always use the internal org_id from tblOrgs
 * instead of the tenant org_id from the JWT token.
 * 
 * For tenant databases: tenant org_id (e.g., "COMPANY") is used for database lookup,
 * but internal org_id (e.g., "ORG001") from tblOrgs is used for data operations.
 */

const { getDbFromContext } = require('./dbContext');

let cachedInternalOrgId = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the internal org_id from tblOrgs
 * This is the org_id that should be used for all data operations (storing/fetching)
 * 
 * @param {Object} dbPool - Optional database pool (uses context if not provided)
 * @returns {Promise<string>} Internal org_id (e.g., "ORG001")
 */
async function getInternalOrgId(dbPool = null) {
  try {
    // Use provided pool or get from context
    const pool = dbPool || getDbFromContext();
    
    // Check cache first
    if (cachedInternalOrgId && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL) {
      return cachedInternalOrgId;
    }
    
    // Query tblOrgs to get the internal org_id
    const result = await pool.query(
      'SELECT org_id FROM "tblOrgs" WHERE int_status = 1 ORDER BY org_id LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      console.warn('[OrgIdHelper] No active organization found in tblOrgs, returning null');
      return null;
    }
    
    const internalOrgId = result.rows[0].org_id;
    
    // Cache the result
    cachedInternalOrgId = internalOrgId;
    cacheTimestamp = Date.now();
    
    console.log(`[OrgIdHelper] Internal org_id retrieved: ${internalOrgId}`);
    return internalOrgId;
  } catch (error) {
    console.error('[OrgIdHelper] Error getting internal org_id:', error.message);
    throw error;
  }
}

/**
 * Clear the internal org_id cache
 * Useful when org_id changes or after tenant setup
 */
function clearCache() {
  cachedInternalOrgId = null;
  cacheTimestamp = null;
  console.log('[OrgIdHelper] Cache cleared');
}

/**
 * Get internal org_id from user object or database
 * If user has internal org_id, use it; otherwise fetch from database
 * 
 * @param {Object} user - User object from req.user
 * @param {Object} dbPool - Optional database pool
 * @returns {Promise<string>} Internal org_id
 */
async function getInternalOrgIdFromUser(user, dbPool = null) {
  // If user object has internal_org_id, use it
  if (user && user.internal_org_id) {
    return user.internal_org_id;
  }
  
  // Otherwise, fetch from database
  return await getInternalOrgId(dbPool);
}

module.exports = {
  getInternalOrgId,
  getInternalOrgIdFromUser,
  clearCache
};

