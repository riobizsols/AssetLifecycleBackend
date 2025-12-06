/**
 * Centralized Branch Filter Helper
 * 
 * This helper automatically applies branch filtering based on req.user.hasSuperAccess
 * Use this in ALL model functions to ensure consistent branch filtering.
 * 
 * The hasSuperAccess flag is automatically set in authMiddleware.js based on tblOrgSettings
 */

/**
 * Apply branch filter to a query conditionally
 * If user has super access, no branch filter is applied (user sees all branches)
 * 
 * @param {Object} options
 * @param {boolean} options.hasSuperAccess - From req.user.hasSuperAccess (set in middleware)
 * @param {string} options.userBranchId - From req.user.branch_id
 * @param {string} options.tableAlias - Table alias (e.g., 'a', 'e', 'u')
 * @param {string} options.branchColumn - Branch column name (default: 'branch_id')
 * @param {number} options.paramIndex - Current parameter index
 * @param {Array} options.existingConditions - Existing WHERE conditions
 * @param {Array} options.existingParams - Existing query parameters
 * @returns {Object} - { conditions: array, params: array, nextParamIndex: number }
 */
const applyBranchFilter = (options = {}) => {
    const {
        hasSuperAccess = false,
        userBranchId = null,
        tableAlias = '',
        branchColumn = 'branch_id',
        paramIndex = 1,
        existingConditions = [],
        existingParams = []
    } = options;

    let conditions = [...existingConditions];
    let params = [...existingParams];
    let nextIndex = paramIndex;

    // If user has super access, skip branch filter (user can see all branches)
    if (!hasSuperAccess && userBranchId) {
        const branchColRef = tableAlias ? `${tableAlias}.${branchColumn}` : branchColumn;
        conditions.push(`${branchColRef} = $${nextIndex}`);
        params.push(userBranchId);
        nextIndex++;
    }

    return {
        conditions,
        params,
        nextParamIndex: nextIndex
    };
};

/**
 * Build WHERE clause with branch filter
 * 
 * @param {Object} options - Same as applyBranchFilter
 * @returns {string} - WHERE clause string
 */
const buildWhereClause = (options = {}) => {
    const { conditions } = applyBranchFilter(options);
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
};

/**
 * Simple helper to check if branch filter should be applied
 * 
 * @param {boolean} hasSuperAccess - From req.user.hasSuperAccess
 * @param {string} userBranchId - From req.user.branch_id
 * @returns {boolean} - True if branch filter should be applied
 */
const shouldApplyBranchFilter = (hasSuperAccess, userBranchId) => {
    return !hasSuperAccess && !!userBranchId;
};

module.exports = {
    applyBranchFilter,
    buildWhereClause,
    shouldApplyBranchFilter
};

