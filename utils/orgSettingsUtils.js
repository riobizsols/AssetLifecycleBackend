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
 * Set a value in tblOrgSettings by key for a specific organization
 * Creates new record if not exists, updates if exists
 * @param {string} key - The setting key
 * @param {string} value - The setting value
 * @param {string} orgId - The organization ID
 * @param {object} dbPool - Optional database pool (if not provided, uses context)
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
const setOrgSetting = async (key, value, orgId, dbPool = null) => {
    try {
        const db = dbPool || getDbFromContext() || getDb();
        
        // Check if setting exists
        const checkQuery = `
            SELECT os_id 
            FROM "tblOrgSettings" 
            WHERE org_id = $1 AND key = $2
            LIMIT 1
        `;
        
        const existingResult = await db.query(checkQuery, [orgId, key]);
        
        if (existingResult.rows.length > 0) {
            // Update existing
            const updateQuery = `
                UPDATE "tblOrgSettings"
                SET value = $1
                WHERE org_id = $2 AND key = $3
                RETURNING *
            `;
            await db.query(updateQuery, [value, orgId, key]);
        } else {
            // Insert new
            // Generate os_id: OS-{orgId}-{timestamp}
            const timestamp = Date.now().toString().slice(-6);
            const os_id = `OS-${orgId}-${timestamp}`;
            
            const insertQuery = `
                INSERT INTO "tblOrgSettings" (os_id, org_id, key, value)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            await db.query(insertQuery, [os_id, orgId, key, value]);
        }
        
        return true;
    } catch (error) {
        console.error(`Error setting org setting ${key} for org ${orgId}:`, error);
        return false;
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
    setOrgSetting,
    getInitialPassword
};

