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
        `SELECT job_role_id, text, job_function, int_status, notif_warranty, notif_scrap
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
    const {
        org_id,
        job_role_id,
        text,
        job_function,
        created_by,
        notif_warranty = false,
        notif_scrap = false
    } = data;
    const dbPool = getDb();

    const result = await dbPool.query(
        `INSERT INTO "tblJobRoles" 
         (org_id, job_role_id, text, job_function, int_status, notif_warranty, notif_scrap)
         VALUES ($1, $2, $3, $4, 1, $5, $6)
         RETURNING *`,
        [org_id, job_role_id, text, job_function || null, !!notif_warranty, !!notif_scrap]
    );
    return result.rows[0];
};

/**
 * Update existing job role in tblJobRoles
 */
const updateJobRoleById = async (job_role_id, data, org_id) => {
    const { text, job_function, int_status, notif_warranty, notif_scrap } = data;
    const dbPool = getDb();

    const result = await dbPool.query(
        `UPDATE "tblJobRoles" 
         SET text = $1, 
             job_function = $2,
             int_status = $3,
             notif_warranty = $4,
             notif_scrap = $5
         WHERE job_role_id = $6 AND org_id = $7
         RETURNING *`,
        [
            text,
            job_function,
            int_status !== undefined ? int_status : 1,
            !!notif_warranty,
            !!notif_scrap,
            job_role_id,
            org_id
        ]
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

/**
 * Delete job roles and their navigation entries (blocked if assigned to users)
 */
const deleteJobRolesByIds = async (job_role_ids, org_id) => {
    const dbPool = getDb();

    const assigned = await dbPool.query(
        `SELECT DISTINCT job_role_id FROM (
            SELECT ujr.job_role_id
            FROM "tblUserJobRoles" ujr
            INNER JOIN "tblUsers" u ON u.user_id = ujr.user_id
            WHERE u.org_id = $1 AND ujr.job_role_id = ANY($2)
            UNION
            SELECT job_role_id FROM "tblUsers"
            WHERE org_id = $1 AND job_role_id = ANY($2) AND int_status = 1
        ) assigned_roles`,
        [org_id, job_role_ids]
    );

    if (assigned.rows.length > 0) {
        const ids = assigned.rows.map((r) => r.job_role_id).join(', ');
        const error = new Error(`Cannot delete role(s) assigned to users: ${ids}`);
        error.code = 'ROLE_IN_USE';
        throw error;
    }

    for (const job_role_id of job_role_ids) {
        await deleteNavigationByJobRole(job_role_id, org_id);
    }

    const result = await dbPool.query(
        `DELETE FROM "tblJobRoles" WHERE org_id = $1 AND job_role_id = ANY($2)`,
        [org_id, job_role_ids]
    );
    return result.rowCount;
};

module.exports = {
    getJobRolesByOrg,
    getJobRoleByIdFromDb,
    createJobRole,
    updateJobRoleById,
    getAllAppIds,
    getNavigationByJobRole,
    deleteNavigationByJobRole,
    insertNavigationForJobRole,
    deleteJobRolesByIds
};