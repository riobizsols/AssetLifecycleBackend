const { getDb } = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

/**
 * Get a value from tblOrgSettings by key for a specific organization
 * @param {string} key - The setting key to look up
 * @param {string} orgId - The organization ID
 * @param {object} dbPool - Optional database pool (if not provided, uses context)
 * @returns {Promise<string|null>} - The setting value or null if not found
 */
const getOrgSetting = async (key, orgId, dbPool = null) => {
    try {
        const db = dbPool || getDbFromContext() || getDb();
        
        const query = `
            SELECT value 
            FROM "tblOrgSettings" 
            WHERE org_id = $1 AND key = $2
            LIMIT 1
        `;
        
        const result = await db.query(query, [orgId, key]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        return result.rows[0].value;
    } catch (error) {
        console.error(`Error fetching org setting ${key} for org ${orgId}:`, error);
        return null;
    }
};

/**
 * Get the initial password from org settings
 * Falls back to "Initial1" if not configured
 * @param {string} orgId - The organization ID
 * @param {object} dbPool - Optional database pool
 * @returns {Promise<string>} - The initial password value
 */
const getInitialPassword = async (orgId, dbPool = null) => {
    const initialPassword = await getOrgSetting('initial_password', orgId, dbPool);
    return initialPassword || 'Initial1'; // Default fallback
};

module.exports = {
    getOrgSetting,
    getInitialPassword
};

