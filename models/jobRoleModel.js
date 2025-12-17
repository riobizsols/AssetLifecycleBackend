const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

/**
 * Get all job roles for an organization
 */
const getJobRolesByOrg = async (org_id) => {
    const dbPool = getDb();

    const result = await dbPool.query(
        `SELECT job_role_id, text, job_function, int_status
         FROM "tblJobRoles" 
         WHERE org_id = $1 AND int_status = 1
         ORDER BY job_role_id DESC`,
        [org_id]
    );
    return result.rows;
};

/**
 * Get specific job role by ID
 */
const getJobRoleByIdFromDb = async (job_role_id, org_id) => {
    const dbPool = getDb();

    const result = await dbPool.query(
        `SELECT * FROM "tblJobRoles" 
         WHERE job_role_id = $1 AND org_id = $2 AND int_status = 1`,
        [job_role_id, org_id]
    );
    return result.rows[0];
};

/**
 * Create a new job role in tblJobRoles
 */
const createJobRole = async (data) => {
    const { org_id, job_role_id, text, job_function, created_by } = data;
    const dbPool = getDb();

    const result = await dbPool.query(
        `INSERT INTO "tblJobRoles" 
         (org_id, job_role_id, text, job_function, int_status)
         VALUES ($1, $2, $3, $4, 1)
         RETURNING *`,
        [org_id, job_role_id, text, job_function || null]
    );
    return result.rows[0];
};

/**
 * Update existing job role in tblJobRoles
 */
const updateJobRoleById = async (job_role_id, data, org_id) => {
    const { text, job_function, int_status } = data;
    const dbPool = getDb();

    const result = await dbPool.query(
        `UPDATE "tblJobRoles" 
         SET text = $1, 
             job_function = $2,
             int_status = $3
         WHERE job_role_id = $4 AND org_id = $5
         RETURNING *`,
        [text, job_function, int_status !== undefined ? int_status : 1, job_role_id, org_id]
    );
    return result.rows[0];
};

/**
 * Get all available App IDs from navigation/application master table
 */
const getAllAppIds = async () => {
    const dbPool = getDb();

    const result = await dbPool.query(
        `SELECT app_id, text as label
         FROM "tblApps" 
         WHERE int_status = true
         ORDER BY text`
    );
    return result.rows;
};

/**
 * Get navigation items assigned to a specific job role from tblJobRoleNav
 */
const getNavigationByJobRole = async (job_role_id, org_id) => {
    const dbPool = getDb();

    const result = await dbPool.query(
        `SELECT 
            jrn.job_role_nav_id,
            jrn.job_role_id,
            jrn.app_id,
            jrn.access_level,
            jrn.mob_desk,
            jrn.sequence,
            a.text as label,
            jrn.is_group,
            jrn.parent_id
         FROM "tblJobRoleNav" jrn
         INNER JOIN "tblApps" a ON jrn.app_id = a.app_id
         WHERE jrn.job_role_id = $1 
           AND jrn.org_id = $2 
           AND jrn.int_status = 1
         ORDER BY jrn.sequence, a.text`,
        [job_role_id, org_id]
    );
    return result.rows;
};

/**
 * Delete all navigation items for a job role from tblJobRoleNav
 */
const deleteNavigationByJobRole = async (job_role_id, org_id) => {
    const dbPool = getDb();

    await dbPool.query(
        `DELETE FROM "tblJobRoleNav" 
         WHERE job_role_id = $1 AND org_id = $2`,
        [job_role_id, org_id]
    );
};

/**
 * Insert navigation items for a job role into tblJobRoleNav
 */
const insertNavigationForJobRole = async (job_role_id, org_id, navigationItems, created_by) => {
    const dbPool = getDb();

    // Generate next job_role_nav_id
    const getNextIdQuery = `
        SELECT job_role_nav_id 
        FROM "tblJobRoleNav" 
        ORDER BY CAST(SUBSTRING(job_role_nav_id FROM 'JRN([0-9]+)') AS INTEGER) DESC 
        LIMIT 1
    `;
    
    const idResult = await dbPool.query(getNextIdQuery);
    let nextIdNum = 1;
    
    if (idResult.rows.length > 0) {
        const lastId = idResult.rows[0].job_role_nav_id;
        const match = lastId.match(/JRN(\d+)/);
        if (match) {
            nextIdNum = parseInt(match[1]) + 1;
        }
    }

    // Insert each navigation item
    const insertPromises = navigationItems.map(async (item, index) => {
        const job_role_nav_id = `JRN${String(nextIdNum + index).padStart(3, '0')}`;
        
        return dbPool.query(
            `INSERT INTO "tblJobRoleNav" 
             (job_role_nav_id, job_role_id, app_id, access_level, mob_desk, sequence, org_id, int_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
            [
                job_role_nav_id,
                job_role_id,
                item.app_id,
                item.access_level || 'display',
                item.mob_desk || 'D',
                item.sequence || (index + 1),
                org_id
            ]
        );
    });

    await Promise.all(insertPromises);
    
    console.log(`✅ Inserted ${navigationItems.length} navigation items for job role ${job_role_id}`);
};

module.exports = {
    getJobRolesByOrg,
    getJobRoleByIdFromDb,
    createJobRole,
    updateJobRoleById,
    getAllAppIds,
    getNavigationByJobRole,
    deleteNavigationByJobRole,
    insertNavigationForJobRole
};