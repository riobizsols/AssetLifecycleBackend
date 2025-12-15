const jwt = require('jsonwebtoken');
const { getUserRoles } = require('../models/userJobRoleModel');
const { getUserWithBranch } = require('../models/userModel');
require('dotenv').config();

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log('=== Auth Middleware Debug ===');
        console.log('decoded token:', decoded);
        console.log('decoded.emp_int_id:', decoded.emp_int_id);

        const { runWithDb } = require('../utils/dbContext');
        const db = require('../config/db');
        let dbPool;
        let isTenant = false;

        // Check if token has use_default_db flag (set by normal login)
        // If use_default_db is true, always use default database regardless of tenants table
        if (decoded.use_default_db === true) {
            // Normal login - always use default database
            dbPool = db;
            isTenant = false;
            console.log(`[AuthMiddleware] Normal login detected (use_default_db=true) - Using default DATABASE_URL for org_id: ${decoded.org_id}`);
        } else {
            // For tenant logins (use_default_db=false), check subdomain to get tenant org_id
            // This is because the user's org_id in the tenant DB might differ from the tenant's org_id
            try {
                const { getOrgIdFromSubdomain, extractSubdomain } = require('../utils/subdomainUtils');
                
                // Try multiple ways to get hostname (for different proxy configurations)
                const hostname = req.get('host') || req.get('x-forwarded-host') || req.hostname || req.headers.host;
                
                if (!hostname) {
                    console.error('[AuthMiddleware] ❌ No hostname found in request');
                    return res.status(400).json({ message: 'Hostname required for tenant login' });
                }
                
                const subdomain = extractSubdomain(hostname);
                
                if (!subdomain) {
                    console.error(`[AuthMiddleware] ❌ No subdomain found in hostname: ${hostname}`);
                    return res.status(400).json({ message: 'Subdomain required for tenant login' });
                }
                
                // Get tenant org_id from subdomain with error handling
                let tenantOrgId;
                try {
                    tenantOrgId = await getOrgIdFromSubdomain(subdomain);
                } catch (subdomainError) {
                    console.error(`[AuthMiddleware] ❌ Error looking up subdomain "${subdomain}":`, subdomainError);
                    return res.status(500).json({ message: 'Error looking up organization' });
                }
                
                if (!tenantOrgId) {
                    console.warn(`[AuthMiddleware] ⚠️ Organization not found for subdomain: ${subdomain}`);
                    return res.status(404).json({ message: `Organization not found for subdomain: ${subdomain}` });
                }
                
                console.log(`[AuthMiddleware] ✅ Subdomain detected: ${subdomain}, tenant org_id: ${tenantOrgId}`);
                
                // Use tenant database - no fallback
                const { getTenantPool, checkTenantExists } = require('../services/tenantService');
                
                // Check if tenant exists
                let tenantExists;
                try {
                    tenantExists = await checkTenantExists(tenantOrgId);
                } catch (checkError) {
                    console.error(`[AuthMiddleware] ❌ Error checking tenant existence for org_id "${tenantOrgId}":`, checkError);
                    return res.status(500).json({ message: 'Error checking tenant status' });
                }
                
                if (!tenantExists) {
                    console.warn(`[AuthMiddleware] ⚠️ Tenant not found or inactive for org_id: ${tenantOrgId}`);
                    return res.status(404).json({ message: `Tenant not found for org_id: ${tenantOrgId}` });
                }
                
                // Get tenant database pool with error handling
                try {
                    dbPool = await getTenantPool(tenantOrgId);
                    isTenant = true;
                    console.log(`[AuthMiddleware] ✅ Tenant user detected - Connected to tenant database for org_id: ${tenantOrgId} (user org_id: ${decoded.org_id})`);
                } catch (poolError) {
                    console.error(`[AuthMiddleware] ❌ Error getting tenant pool for org_id "${tenantOrgId}":`, poolError);
                    return res.status(500).json({ message: 'Error connecting to tenant database' });
                }
            } catch (error) {
                // Catch any unexpected errors
                console.error('[AuthMiddleware] ❌ Unexpected error in tenant login flow:', error);
                return res.status(500).json({ message: 'Internal server error during tenant authentication' });
            }
        }

        // Attach database pool to request so controllers/models can use it
        req.db = dbPool;
        req.tenantPool = isTenant ? dbPool : null; // Only set if tenant
        req.isTenant = isTenant; // Flag to indicate if this is a tenant user
        
        // Set database in async context so all models can access it
        // This allows models to use getDb() without passing dbConnection through every function
        return runWithDb(dbPool, async () => {
            // Helper function to retry on connection pool exhaustion
            const retryOnPoolExhaustion = async (fn, maxRetries = 3, delay = 100) => {
                for (let i = 0; i < maxRetries; i++) {
                    try {
                        return await fn();
                    } catch (error) {
                        // Check if it's a connection pool exhaustion error
                        if (error.code === '53300' || (error.message && error.message.includes('too many clients'))) {
                            // Log pool stats if available
                            if (dbPool && typeof dbPool.totalCount !== 'undefined') {
                                console.error(`[AuthMiddleware] Pool stats - Total: ${dbPool.totalCount}, Idle: ${dbPool.idleCount}, Waiting: ${dbPool.waitingCount}, Active: ${dbPool.totalCount - dbPool.idleCount}`);
                            }
                            
                            if (i < maxRetries - 1) {
                                console.warn(`[AuthMiddleware] Connection pool exhausted, retrying (${i + 1}/${maxRetries}) after ${delay * (i + 1)}ms...`);
                                await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); // Exponential backoff
                                continue;
                            } else {
                                console.error(`[AuthMiddleware] Connection pool exhausted after ${maxRetries} retries`);
                                console.error(`[AuthMiddleware] This usually means PostgreSQL max_connections limit is reached.`);
                                console.error(`[AuthMiddleware] Solution: Close unused DBeaver connections or increase PostgreSQL max_connections`);
                                throw new Error('Database connection pool is full. Please close unused database connections (e.g., DBeaver) and try again.');
                            }
                        }
                        throw error;
                    }
                }
            };

            // Fetch current user roles from tblUserJobRoles (using appropriate database)
            const userRoles = await retryOnPoolExhaustion(() => getUserRoles(decoded.user_id, dbPool));

            // Fetch user with branch information (using appropriate database)
            const userWithBranch = await retryOnPoolExhaustion(() => getUserWithBranch(decoded.user_id, dbPool));

            // Get internal org_id from tblOrgs (for data operations)
            // This is the org_id that should be used for storing/fetching data
            let internalOrgId = decoded.org_id; // Default to token org_id
            try {
                const orgResult = await retryOnPoolExhaustion(() => 
                    dbPool.query('SELECT org_id FROM "tblOrgs" WHERE int_status = 1 ORDER BY org_id LIMIT 1')
                );
                if (orgResult.rows.length > 0) {
                    internalOrgId = orgResult.rows[0].org_id;
                    console.log(`[AuthMiddleware] Internal org_id from tblOrgs: ${internalOrgId} (tenant org_id: ${decoded.org_id})`);
                }
            } catch (orgError) {
                console.warn(`[AuthMiddleware] Could not fetch internal org_id from tblOrgs:`, orgError.message);
                // Fall back to token org_id
            }

            // Check if user has super access (can view all branches)
            const { hasSuperAccess } = require('../utils/branchAccessUtils');
            const hasSuperAccessFlag = await retryOnPoolExhaustion(() => 
                hasSuperAccess(decoded.user_id, internalOrgId)
            );
            
            if (hasSuperAccessFlag) {
                console.log(`[AuthMiddleware] User ${decoded.user_id} has SUPER ACCESS - can view all branches`);
            }

            // Attach full decoded info with current roles and branch information
            req.user = {
                org_id: internalOrgId, // Use internal org_id for all data operations
                tenant_org_id: decoded.org_id, // Keep tenant org_id for reference
                user_id: decoded.user_id,
                job_role_id: decoded.job_role_id, // Keep for backward compatibility
                email: decoded.email,
                emp_int_id: decoded.emp_int_id,
                roles: userRoles, // Current roles from tblUserJobRoles
                branch_id: userWithBranch?.branch_id || null,
                branch_name: userWithBranch?.branch_name || null,
                branch_code: userWithBranch?.branch_code || null,
                dept_id: userWithBranch?.dept_id || null,
                dept_name: userWithBranch?.dept_name || null,
                hasSuperAccess: hasSuperAccessFlag, // Flag indicating user can view all branches
                isTenant: isTenant // Add flag to user object
            };

            next();
        });
    } catch (err) {
        // Handle connection pool exhaustion specifically
        if (err.code === '53300' || (err.message && err.message.includes('too many clients'))) {
            console.error('[AuthMiddleware] Connection pool exhausted:', err.message);
            return res.status(503).json({ 
                message: 'Server is busy. Please try again in a moment.',
                error: 'Database connection pool exhausted'
            });
        }
        // Handle other errors
        console.error('[AuthMiddleware] Authentication error:', err.message);
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }
};

module.exports = { protect };



