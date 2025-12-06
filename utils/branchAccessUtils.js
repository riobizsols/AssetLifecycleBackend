const { getDbFromContext } = require('./dbContext');

/**
 * Check if a user has super access (can view all branches)
 * This checks tblOrgSettings for a key 'super_access_users' or 'all_branch_access_users'
 * The value should be a comma-separated list of user_ids
 * 
 * @param {string} userId - The user_id to check
 * @param {string} orgId - The organization ID
 * @returns {Promise<boolean>} - True if user has super access, false otherwise
 */
const hasSuperAccess = async (userId, orgId) => {
    try {
        const dbPool = getDbFromContext();
        
        // Check for super_access_users setting
        const result = await dbPool.query(
            `SELECT value 
             FROM "tblOrgSettings" 
             WHERE org_id = $1 
             AND key IN ('super_access_users', 'all_branch_access_users')`,
            [orgId]
        );
        
        if (result.rows.length === 0) {
            return false;
        }
        
        // The value can be a comma-separated list of user_ids
        const superAccessUsers = result.rows.map(row => row.value).join(',').split(',').map(u => u.trim());
        
        return superAccessUsers.includes(userId);
    } catch (error) {
        console.error('Error checking super access:', error);
        return false; // Default to false on error
    }
};

/**
 * Build branch filter condition for SQL queries
 * Returns the condition string and parameters array
 * 
 * @param {string} userBranchId - The user's branch_id
 * @param {boolean} hasSuperAccess - Whether user has super access
 * @param {string} tableAlias - Table alias (e.g., 'a' for assets, 'u' for users)
 * @param {number} paramIndex - Starting parameter index (default: 1)
 * @returns {Object} - { condition: string, params: array, nextParamIndex: number }
 */
const buildBranchFilter = (userBranchId, hasSuperAccess, tableAlias = '', paramIndex = 1) => {
    // If user has super access, don't filter by branch
    if (hasSuperAccess) {
        return {
            condition: '', // No filter
            params: [],
            nextParamIndex: paramIndex
        };
    }
    
    // If no branch_id, don't filter (or you might want to return empty results)
    if (!userBranchId) {
        return {
            condition: '', // No filter if no branch
            params: [],
            nextParamIndex: paramIndex
        };
    }
    
    // Build the condition with table alias
    const branchColumn = tableAlias ? `${tableAlias}.branch_id` : 'branch_id';
    return {
        condition: ` AND ${branchColumn} = $${paramIndex}`,
        params: [userBranchId],
        nextParamIndex: paramIndex + 1
    };
};

/**
 * Get user's effective branch filter
 * This is a convenience function that combines hasSuperAccess and buildBranchFilter
 * 
 * @param {string} userId - The user_id
 * @param {string} orgId - The organization ID
 * @param {string} userBranchId - The user's branch_id
 * @param {string} tableAlias - Table alias for the query
 * @param {number} paramIndex - Starting parameter index
 * @returns {Promise<Object>} - { condition: string, params: array, nextParamIndex: number, hasSuperAccess: boolean }
 */
const getUserBranchFilter = async (userId, orgId, userBranchId, tableAlias = '', paramIndex = 1) => {
    const superAccess = await hasSuperAccess(userId, orgId);
    const filter = buildBranchFilter(userBranchId, superAccess, tableAlias, paramIndex);
    
    return {
        ...filter,
        hasSuperAccess: superAccess
    };
};

module.exports = {
    hasSuperAccess,
    buildBranchFilter,
    getUserBranchFilter
};

