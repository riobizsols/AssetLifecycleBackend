const jwt = require('jsonwebtoken');
const { getUserRoles } = require('../models/userJobRoleModel');
const { getUserWithBranch } = require('../models/userModel');
const cacheService = require('../services/cacheService');
require('dotenv').config();

function buildAuthCacheKey(decoded) {
    return cacheService.buildKey(
        'auth',
        'ctx',
        decoded.user_id,
        decoded.org_id || 'none',
        decoded.use_default_db ? '1' : '0',
        decoded.iat || 0,
    );
}

async function resolveDatabasePool(decoded) {
    const db = require('../config/db');
    let dbPool;
    let isTenant = false;

    if (decoded.use_default_db === true) {
        return { dbPool: db, isTenant: false };
    }

    if (decoded.org_id) {
        const { getTenantPool, checkTenantExists } = require('../services/tenantService');
        try {
            const tenantExists = await checkTenantExists(decoded.org_id);
            if (tenantExists) {
                dbPool = await getTenantPool(decoded.org_id);
                isTenant = true;
            } else {
                dbPool = db;
                isTenant = false;
            }
        } catch (tenantError) {
            console.warn(`[AuthMiddleware] Tenant lookup failed for org_id ${decoded.org_id}, using default database:`, tenantError.message);
            dbPool = db;
            isTenant = false;
        }
    } else {
        dbPool = db;
        isTenant = false;
    }

    return { dbPool, isTenant };
}

async function retryOnPoolExhaustion(dbPool, fn, maxRetries = 3, delay = 150) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            const msg = String(error?.message || '');
            const code = error?.code;

            if (code === '53300' || msg.includes('too many clients')) {
                if (dbPool && typeof dbPool.totalCount !== 'undefined') {
                    console.error(`[AuthMiddleware] Pool stats - Total: ${dbPool.totalCount}, Idle: ${dbPool.idleCount}, Waiting: ${dbPool.waitingCount}, Active: ${dbPool.totalCount - dbPool.idleCount}`);
                }

                if (i < maxRetries - 1) {
                    console.warn(`[AuthMiddleware] Connection pool exhausted, retrying (${i + 1}/${maxRetries}) after ${delay * (i + 1)}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
                    continue;
                }

                throw new Error('Database connection pool is full. Please close unused database connections (e.g., DBeaver) and try again.');
            }

            const transientCodes = new Set(['EADDRNOTAVAIL', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE']);
            if (transientCodes.has(code)) {
                if (i < maxRetries - 1) {
                    const waitMs = delay * (i + 1);
                    console.warn(`[AuthMiddleware] Transient DB error (${code}), retrying (${i + 1}/${maxRetries}) after ${waitMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    continue;
                }
            }

            throw error;
        }
    }
}

async function buildUserContext(decoded, dbPool, isTenant) {
    const userRoles = await retryOnPoolExhaustion(dbPool, () => getUserRoles(decoded.user_id, dbPool));
    const userWithBranch = await retryOnPoolExhaustion(dbPool, () => getUserWithBranch(decoded.user_id, dbPool));

    let internalOrgId = decoded.org_id;
    try {
        const orgResult = await retryOnPoolExhaustion(dbPool, () =>
            dbPool.query('SELECT org_id FROM "tblOrgs" WHERE int_status = 1 ORDER BY org_id LIMIT 1')
        );
        if (orgResult.rows.length > 0) {
            internalOrgId = orgResult.rows[0].org_id;
        }
    } catch (orgError) {
        console.warn(`[AuthMiddleware] Could not fetch internal org_id from tblOrgs:`, orgError.message);
    }

    const { hasSuperAccess } = require('../utils/branchAccessUtils');
    const hasSuperAccessFlag = await retryOnPoolExhaustion(dbPool, () =>
        hasSuperAccess(decoded.user_id, internalOrgId)
    );

    return {
        user: {
            org_id: internalOrgId,
            tenant_org_id: decoded.org_id,
            user_id: decoded.user_id,
            job_role_id: decoded.job_role_id,
            email: decoded.email,
            emp_int_id: decoded.emp_int_id,
            language_code: (decoded.language_code || decoded.lang_code || 'en').toLowerCase(),
            roles: userRoles,
            branch_id: userWithBranch?.branch_id || null,
            branch_name: userWithBranch?.branch_name || null,
            branch_code: userWithBranch?.branch_code || null,
            dept_id: userWithBranch?.dept_id || null,
            dept_name: userWithBranch?.dept_name || null,
            hasSuperAccess: hasSuperAccessFlag,
            isTenant,
        },
        isTenant,
    };
}

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { runWithDb } = require('../utils/dbContext');
        const cacheKey = buildAuthCacheKey(decoded);

        // Fast path: skip repeated user-context DB lookups when auth is cached
        const cached = await cacheService.get(cacheKey);
        if (cached?.user) {
            const { dbPool, isTenant } = await resolveDatabasePool(decoded);
            req.db = dbPool;
            req.tenantPool = isTenant ? dbPool : null;
            req.isTenant = isTenant;
            req.user = cached.user;
            return runWithDb(dbPool, () => next());
        }

        const { dbPool, isTenant } = await resolveDatabasePool(decoded);
        req.db = dbPool;
        req.tenantPool = isTenant ? dbPool : null;
        req.isTenant = isTenant;

        return runWithDb(dbPool, async () => {
            const context = await buildUserContext(decoded, dbPool, isTenant);
            req.user = context.user;

            await cacheService.set(cacheKey, { user: context.user }, cacheService.getAuthCacheTtlMs());

            next();
        });
    } catch (err) {
        if (err.code === '53300' || (err.message && err.message.includes('too many clients'))) {
            console.error('[AuthMiddleware] Connection pool exhausted:', err.message);
            return res.status(503).json({
                message: 'Server is busy. Please try again in a moment.',
                error: 'Database connection pool exhausted'
            });
        }
        console.error('[AuthMiddleware] Authentication error:', err.message);
        return res.status(401).json({ message: 'Session expired. Please login again.' });
    }
};

module.exports = { protect };
