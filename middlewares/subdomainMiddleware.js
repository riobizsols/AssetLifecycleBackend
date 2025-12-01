/**
 * Subdomain Middleware
 * 
 * Extracts subdomain from request and sets org_id in request context
 */

const { getOrgIdFromSubdomain, extractSubdomain } = require('../utils/subdomainUtils');

/**
 * Middleware to extract subdomain and set org_id in request
 */
async function subdomainMiddleware(req, res, next) {
  try {
    // Extract subdomain from hostname
    const hostname = req.get('host') || req.hostname;
    const subdomain = extractSubdomain(hostname);
    
    // Store subdomain in request
    req.subdomain = subdomain;
    
    // If subdomain exists, get org_id
    if (subdomain) {
      const orgId = await getOrgIdFromSubdomain(subdomain);
      req.org_id_from_subdomain = orgId;
      
      console.log(`[SubdomainMiddleware] Subdomain: ${subdomain}, Org ID: ${orgId || 'NOT FOUND'}`);
    } else {
      console.log('[SubdomainMiddleware] No subdomain found in request');
    }
    
    next();
  } catch (error) {
    console.error('[SubdomainMiddleware] Error:', error);
    // Don't block the request, just log the error
    next();
  }
}

module.exports = {
  subdomainMiddleware,
};

