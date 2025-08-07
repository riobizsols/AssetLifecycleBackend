const db = require('../config/db');

/**
 * Get navigation items for a specific job role filtered by platform
 * @param {string} job_role_id - The job role ID
 * @param {string} platform - Platform filter ('D' for Desktop, 'M' for Mobile)
 * @returns {Promise<Array>} Array of navigation items
 */
// Get navigation items for a specific job role
const getNavigationByJobRole = async (job_role_id, platform = 'D') => {
    const result = await db.query(
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
    const result = await db.query(
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

    const result = await db.query(
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

    const result = await db.query(
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
    const result = await db.query(
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
// Get user's navigation based on their job role
const getUserNavigation = async (user_id, platform = 'D') => {
    // First get the user's job role
    const userJobRoleQuery = await db.query(
        `SELECT job_role_id FROM "tblUserJobRoles" 
         WHERE user_id = $1`,
        [user_id]
    );
    
    if (userJobRoleQuery.rows.length === 0) {
        return [];
    }
    
    const job_role_id = userJobRoleQuery.rows[0].job_role_id;
    
    // Then get the navigation for that job role with platform filter
    return await getNavigationStructure(job_role_id, platform);
};

module.exports = {
    getNavigationByJobRole,
    getAllNavigationItems,
    createNavigationItem,
    updateNavigationItem,
    deleteNavigationItem,
    getNavigationStructure,
    getUserNavigation
}; 