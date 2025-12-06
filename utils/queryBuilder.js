const { getDbFromContext } = require('./dbContext');

/**
 * Centralized Query Builder for Branch Filtering
 * 
 * This utility automatically applies branch filtering based on user's super access status.
 * Use this in all model functions to ensure consistent branch filtering across the application.
 */

/**
 * Build a WHERE clause with automatic branch filtering
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.userId - User ID from req.user.user_id
 * @param {string} options.orgId - Organization ID from req.user.org_id
 * @param {string} options.userBranchId - User's branch_id from req.user.branch_id
 * @param {boolean} options.hasSuperAccess - User's super access flag from req.user.hasSuperAccess
 * @param {string} options.tableAlias - Table alias (e.g., 'a' for assets, 'e' for employees)
 * @param {string} options.branchColumn - Branch column name (default: 'branch_id')
 * @param {number} options.startParamIndex - Starting parameter index (default: 1)
 * @param {Array} options.existingParams - Existing query parameters array
 * @param {Array} options.existingConditions - Existing WHERE conditions array
 * @returns {Object} - { condition: string, params: array, nextParamIndex: number }
 */
const buildQueryWithBranchFilter = (options = {}) => {
    const {
        userId,
        orgId,
        userBranchId,
        hasSuperAccess,
        tableAlias = '',
        branchColumn = 'branch_id',
        startParamIndex = 1,
        existingParams = [],
        existingConditions = []
    } = options;

    let conditions = [...existingConditions];
    let params = [...existingParams];
    let paramIndex = startParamIndex;

    // Build branch column reference
    const branchColRef = tableAlias ? `${tableAlias}.${branchColumn}` : branchColumn;

    // Apply branch filter only if user doesn't have super access
    if (!hasSuperAccess && userBranchId) {
        conditions.push(`${branchColRef} = $${paramIndex}`);
        params.push(userBranchId);
        paramIndex++;
    }
    // If hasSuperAccess is true, no branch filter is applied (user can see all branches)

    // Build WHERE clause
    const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    return {
        whereClause,
        params,
        nextParamIndex: paramIndex,
        hasBranchFilter: !hasSuperAccess && !!userBranchId
    };
};

/**
 * Build a complete query with automatic branch filtering
 * This is a higher-level helper that builds the entire query
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.baseQuery - Base SELECT query (without WHERE clause)
 * @param {string} options.userId - User ID from req.user.user_id
 * @param {string} options.orgId - Organization ID from req.user.org_id
 * @param {string} options.userBranchId - User's branch_id from req.user.branch_id
 * @param {boolean} options.hasSuperAccess - User's super access flag from req.user.hasSuperAccess
 * @param {string} options.tableAlias - Table alias
 * @param {string} options.branchColumn - Branch column name
 * @param {Array} options.additionalConditions - Additional WHERE conditions
 * @param {Array} options.additionalParams - Additional parameters
 * @param {string} options.orderBy - ORDER BY clause (optional)
 * @param {string} options.limit - LIMIT clause (optional)
 * @returns {Object} - { query: string, params: array }
 */
const buildQuery = (options = {}) => {
    const {
        baseQuery,
        userId,
        orgId,
        userBranchId,
        hasSuperAccess,
        tableAlias = '',
        branchColumn = 'branch_id',
        additionalConditions = [],
        additionalParams = [],
        orderBy = '',
        limit = ''
    } = options;

    // Build conditions
    const conditions = [...additionalConditions];
    const params = [...additionalParams];
    let paramIndex = params.length + 1;

    // Apply branch filter
    if (!hasSuperAccess && userBranchId) {
        const branchColRef = tableAlias ? `${tableAlias}.${branchColumn}` : branchColumn;
        conditions.push(`${branchColRef} = $${paramIndex}`);
        params.push(userBranchId);
        paramIndex++;
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    // Combine query parts
    let query = baseQuery;
    if (whereClause) {
        query += ` ${whereClause}`;
    }
    if (orderBy) {
        query += ` ${orderBy}`;
    }
    if (limit) {
        query += ` ${limit}`;
    }

    return {
        query,
        params
    };
};

/**
 * Helper to extract user context from req.user
 * Use this in controllers to get user context for queries
 * 
 * @param {Object} reqUser - req.user object from middleware
 * @returns {Object} - User context for queries
 */
const getUserContext = (reqUser) => {
    if (!reqUser) {
        return {
            userId: null,
            orgId: null,
            userBranchId: null,
            hasSuperAccess: false
        };
    }

    return {
        userId: reqUser.user_id,
        orgId: reqUser.org_id,
        userBranchId: reqUser.branch_id,
        hasSuperAccess: reqUser.hasSuperAccess || false
    };
};

/**
 * Execute a query with automatic branch filtering
 * 
 * @param {Object} options - Query options
 * @param {string} options.baseQuery - Base SELECT query
 * @param {Object} options.userContext - User context from getUserContext()
 * @param {string} options.tableAlias - Table alias
 * @param {Array} options.conditions - Additional WHERE conditions
 * @param {Array} options.params - Additional parameters
 * @param {string} options.orderBy - ORDER BY clause
 * @param {string} options.limit - LIMIT clause
 * @param {Object} options.dbConnection - Database connection (optional)
 * @returns {Promise<Object>} - Query result
 */
const executeQueryWithBranchFilter = async (options = {}) => {
    const {
        baseQuery,
        userContext,
        tableAlias = '',
        conditions = [],
        params = [],
        orderBy = '',
        limit = '',
        dbConnection = null
    } = options;

    const { getDbFromContext } = require('./dbContext');
    const db = dbConnection || getDbFromContext();

    // Build query with branch filter
    const { query, params: finalParams } = buildQuery({
        baseQuery,
        userId: userContext.userId,
        orgId: userContext.orgId,
        userBranchId: userContext.userBranchId,
        hasSuperAccess: userContext.hasSuperAccess,
        tableAlias,
        additionalConditions: conditions,
        additionalParams: params,
        orderBy,
        limit
    });

    return await db.query(query, finalParams);
};

module.exports = {
    buildQueryWithBranchFilter,
    buildQuery,
    getUserContext,
    executeQueryWithBranchFilter
};

