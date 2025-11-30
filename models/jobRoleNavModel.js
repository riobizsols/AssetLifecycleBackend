const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


/**
 * Get navigation items for a specific job role filtered by platform
 * @param {string} job_role_id - The job role ID
 * @param {string} platform - Platform filter ('D' for Desktop, 'M' for Mobile)
 * @returns {Promise<Array>} Array of navigation items
 */
// Get navigation items for a specific job role
const getNavigationByJobRole = async (job_role_id, platform = 'D') => {
    const dbPool = getDb();

    const result = await dbPool.query(
        `SELECT 
            job_role_nav_id as id,
            int_status,
            job_role_id,
            parent_id,
            app_id,
            label,
            is_group,
            access_level,
            mob_desk as mobile_desktop,
            sequence
         FROM "tblJobRoleNav" 
         WHERE job_role_id = $1 AND int_status = 1 AND mob_desk = $2
         ORDER BY sequence, job_role_nav_id`,
        [job_role_id, platform]
    );
    return result.rows;
};

// Get all navigation items for all job roles
const getAllNavigationItems = async () => {
    const dbPool = getDb();

    const result = await dbPool.query(
        `SELECT 
            job_role_nav_id as id,
            int_status,
            job_role_id,
            parent_id,
            app_id,
            label,
            is_group,
            access_level,
            mob_desk as mobile_desktop,
            sequence
         FROM "tblJobRoleNav" 
         WHERE int_status = 1
         ORDER BY job_role_id, sequence, job_role_nav_id`
    );
    return result.rows;
};

// Create navigation item for a job role
const createNavigationItem = async (data) => {
    const {
        job_role_id,
        parent_id,
        app_id,
        label,
        is_group,
        seq,
        access_level,
        mobile_desktop = 'D'
    } = data;

    const dbPool = getDb();


    const result = await dbPool.query(
        `INSERT INTO "tblJobRoleNav" 
         (job_role_id, parent_id, app_id, label, is_group, seq, access_level, mobile_desktop, int_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
         RETURNING *`,
        [job_role_id, parent_id, app_id, label, is_group, seq, access_level, mobile_desktop]
    );
    return result.rows[0];
};

// Update navigation item
const updateNavigationItem = async (id, data) => {
    const {
        parent_id,
        app_id,
        label,
        is_group,
        seq,
        access_level,
        mobile_desktop
    } = data;

    const dbPool = getDb();


    const result = await dbPool.query(
        `UPDATE "tblJobRoleNav" 
         SET parent_id = $2, 
             app_id = $3, 
             label = $4, 
             is_group = $5, 
             seq = $6, 
             access_level = $7, 
             mobile_desktop = $8
         WHERE id = $1
         RETURNING *`,
        [id, parent_id, app_id, label, is_group, seq, access_level, mobile_desktop]
    );
    return result.rows[0];
};

// Delete navigation item
const deleteNavigationItem = async (id) => {
    const dbPool = getDb();

    const result = await dbPool.query(
        `UPDATE "tblJobRoleNav" 
         SET int_status = 0
         WHERE id = $1
         RETURNING *`,
        [id]
    );
    return result.rows[0];
};

/**
 * Get navigation structure for a job role organized by groups and filtered by platform
 * @param {string} job_role_id - The job role ID
 * @param {string} platform - Platform filter ('D' for Desktop, 'M' for Mobile)
 * @returns {Promise<Array>} Array of organized navigation items
 */
// Get navigation structure for a job role (organized by groups)
const getNavigationStructure = async (job_role_id, platform = 'D') => {
    const items = await getNavigationByJobRole(job_role_id, platform);
    
    // Create a map of all items
    const itemMap = new Map();
    const topLevelItems = [];
    
    // First pass: create item map and identify top-level items
    items.forEach(item => {
        itemMap.set(item.id, {
            ...item,
            children: []
        });
        
        // Top-level items are those without parents OR are groups
        if (!item.parent_id || item.is_group) {
            topLevelItems.push(itemMap.get(item.id));
        }
    });
    
    // Second pass: organize children under their parents
    items.forEach(item => {
        if (item.parent_id && itemMap.has(item.parent_id)) {
            const parent = itemMap.get(item.parent_id);
            parent.children.push(itemMap.get(item.id));
        }
    });
    
    // Return only top-level items
    return topLevelItems;
};

/**
 * Get user's navigation based on their job role and platform
 * @param {string} user_id - The user ID
 * @param {string} platform - Platform filter ('D' for Desktop, 'M' for Mobile)
 * @returns {Promise<Array>} Array of user's navigation items
 */
// Get user's navigation based on their job roles (supports multiple roles)
const getUserNavigation = async (user_id, platform = 'D') => {
    try {
        // Get all user's job roles
        const dbPool = getDb();
        
        console.log(`[JobRoleNavModel] Getting navigation for user_id: ${user_id}, platform: ${platform}`);
        console.log(`[JobRoleNavModel] Using database pool: ${dbPool ? 'EXISTS' : 'NULL'}`);

        const userJobRoleQuery = await dbPool.query(
            `SELECT job_role_id FROM "tblUserJobRoles" 
             WHERE user_id = $1`,
            [user_id]
        );
        
        console.log(`[JobRoleNavModel] User job roles found: ${userJobRoleQuery.rows.length}`);
        
        if (userJobRoleQuery.rows.length === 0) {
            console.log(`[JobRoleNavModel] No job roles found for user ${user_id}`);
            return [];
        }
        
        const job_role_ids = userJobRoleQuery.rows.map(row => row.job_role_id);
        console.log(`[JobRoleNavModel] Job role IDs: ${job_role_ids.join(', ')}`);
        
        // Get navigation for all roles and combine permissions
        const navigation = await getCombinedNavigationStructure(job_role_ids, platform);
        console.log(`[JobRoleNavModel] Navigation items returned: ${navigation.length}`);
        
        return navigation;
    } catch (error) {
        console.error(`[JobRoleNavModel] Error in getUserNavigation:`, error);
        throw error;
    }
};

// Get combined navigation structure for multiple job roles
const getCombinedNavigationStructure = async (job_role_ids, platform = 'D') => {
    try {
        // Get navigation items for all job roles
        const dbPool = getDb();
        
        console.log(`[JobRoleNavModel] Getting combined navigation for job_role_ids: ${job_role_ids.join(', ')}, platform: ${platform}`);

        const allNavigationItems = await dbPool.query(`
            SELECT 
                jrn.job_role_nav_id as id,
                jrn.job_role_id,
                jrn.parent_id,
                jrn.app_id,
                jrn.label,
                jrn.is_group,
                jrn.sequence as seq,
                jrn.access_level,
                jrn.mob_desk as mobile_desktop,
                jr.text as job_role_name
            FROM "tblJobRoleNav" jrn
            JOIN "tblJobRoles" jr ON jrn.job_role_id = jr.job_role_id
            WHERE jrn.job_role_id = ANY($1) 
            AND jrn.int_status = 1
            AND (jrn.mob_desk = $2 OR jrn.mob_desk IS NULL)
            ORDER BY jrn.sequence, jrn.label
        `, [job_role_ids, platform]);
        
        console.log(`[JobRoleNavModel] Navigation items from database: ${allNavigationItems.rows.length}`);

        // Group items by app_id and combine permissions
        const combinedItems = {};
        
        allNavigationItems.rows.forEach(item => {
            const appId = item.app_id;
            
            if (!combinedItems[appId]) {
                // First time seeing this app_id
                combinedItems[appId] = {
                    id: item.id,
                    job_role_id: item.job_role_id,
                    parent_id: item.parent_id,
                    app_id: item.app_id,
                    label: item.label,
                    is_group: item.is_group,
                    seq: item.seq,
                    access_level: item.access_level,
                    mobile_desktop: item.mobile_desktop,
                    job_role_name: item.job_role_name,
                    roles: [item.job_role_name]
                };
            } else {
                // Combine permissions - use highest access level
                const currentAccess = combinedItems[appId].access_level;
                const newAccess = item.access_level;
                
                // Access level hierarchy: A (Full) > D (Read) > NULL (No Access)
                if (newAccess === 'A' || (newAccess === 'D' && currentAccess !== 'A')) {
                    combinedItems[appId].access_level = newAccess;
                }
                
                // Add role name if not already present
                if (!combinedItems[appId].roles.includes(item.job_role_name)) {
                    combinedItems[appId].roles.push(item.job_role_name);
                }
            }
        });

        // Convert to array and sort
        const navigationItems = Object.values(combinedItems).sort((a, b) => a.seq - b.seq);
        
        // Build hierarchical structure
        const itemMap = new Map();
        const topLevelItems = [];
        
        // First pass: create all items
        navigationItems.forEach(item => {
            itemMap.set(item.id, { ...item, children: [] });
        });
        
        // Second pass: build hierarchy
        navigationItems.forEach(item => {
            if (item.parent_id && itemMap.has(item.parent_id)) {
                itemMap.get(item.parent_id).children.push(itemMap.get(item.id));
            } else {
                topLevelItems.push(itemMap.get(item.id));
            }
        });
        
        return topLevelItems;
    } catch (error) {
        console.error('Error getting combined navigation structure:', error);
        return [];
    }
};

module.exports = {
    getNavigationByJobRole,
    getAllNavigationItems,
    createNavigationItem,
    updateNavigationItem,
    deleteNavigationItem,
    getNavigationStructure,
    getUserNavigation,
    getCombinedNavigationStructure
}; 