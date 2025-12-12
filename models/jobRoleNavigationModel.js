const { getDbFromContext } = require('../utils/dbContext');

// Helper to get database (tenant or default)
const getDb = () => getDbFromContext();

/**
 * Get all navigation entries for organization
 */
const getAllNavigationEntries = async (org_id) => {
    const dbPool = getDb();
    
    const query = `
        SELECT 
            jrn.job_role_nav_id,
            jrn.org_id,
            jrn.int_status,
            jrn.job_role_id,
            jrn.parent_id,
            jrn.app_id,
            jrn.label,
            jrn.sub_menu,
            jrn.sequence,
            jrn.access_level,
            jrn.is_group,
            jrn.mob_desk,
            jr.text as job_role_name,
            ai.text as app_label
        FROM "tblJobRoleNav" jrn
        LEFT JOIN "tblJobRoles" jr ON jrn.job_role_id = jr.job_role_id AND jrn.org_id = jr.org_id
        LEFT JOIN "tblApps" ai ON jrn.app_id = ai.app_id
        WHERE jrn.org_id = $1
        ORDER BY jrn.job_role_id, jrn.sequence
    `;
    
    const result = await dbPool.query(query, [org_id]);
    return result.rows;
};

/**
 * Create new navigation entry
 */
const createNavigationEntry = async (data) => {
    const dbPool = getDb();
    
    const {
        job_role_nav_id,
        org_id,
        job_role_id,
        app_id,
        label,
        access_level,
        is_group,
        mob_desk,
        sequence,
        parent_id
    } = data;

    const query = `
        INSERT INTO "tblJobRoleNav" (
            job_role_nav_id,
            org_id,
            int_status,
            job_role_id,
            app_id,
            label,
            access_level,
            is_group,
            mob_desk,
            sequence,
            parent_id,
            sub_menu
        ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, '')
        RETURNING *
    `;

    const result = await dbPool.query(query, [
        job_role_nav_id,
        org_id,
        job_role_id,
        app_id,
        label,
        access_level,
        is_group,
        mob_desk,
        sequence,
        parent_id || null
    ]);

    return result.rows[0];
};

/**
 * Update navigation entry
 */
const updateNavigationEntry = async (job_role_nav_id, data, org_id) => {
    const dbPool = getDb();
    
    const {
        job_role_id,
        app_id,
        label,
        access_level,
        is_group,
        mob_desk,
        sequence,
        parent_id,
        int_status
    } = data;

    const query = `
        UPDATE "tblJobRoleNav"
        SET 
            job_role_id = COALESCE($1, job_role_id),
            app_id = COALESCE($2, app_id),
            label = COALESCE($3, label),
            access_level = COALESCE($4, access_level),
            is_group = COALESCE($5, is_group),
            mob_desk = COALESCE($6, mob_desk),
            sequence = COALESCE($7, sequence),
            parent_id = $8,
            int_status = COALESCE($9, int_status)
        WHERE job_role_nav_id = $10 AND org_id = $11
        RETURNING *
    `;

    const result = await dbPool.query(query, [
        job_role_id,
        app_id,
        label,
        access_level,
        is_group,
        mob_desk,
        sequence,
        parent_id || null,
        int_status !== undefined ? int_status : 1,
        job_role_nav_id,
        org_id
    ]);

    return result.rows[0];
};

/**
 * Bulk create navigation entries (with transaction)
 */
const bulkCreateNavigationEntries = async (entries, org_id) => {
    const dbPool = getDb();
    const client = await dbPool.connect();
    
    try {
        await client.query('BEGIN');
        
        const createdEntries = [];
        const insertQuery = `
            INSERT INTO "tblJobRoleNav" (
                job_role_nav_id,
                org_id,
                int_status,
                job_role_id,
                app_id,
                label,
                access_level,
                is_group,
                mob_desk,
                sequence,
                parent_id,
                sub_menu
            ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9, $10, '')
            RETURNING *
        `;

        for (const entry of entries) {
            const {
                job_role_nav_id,
                job_role_id,
                app_id,
                label,
                access_level,
                is_group,
                mob_desk,
                sequence,
                parent_id
            } = entry;

            const result = await client.query(insertQuery, [
                job_role_nav_id,
                org_id,
                job_role_id,
                app_id,
                label || "",
                access_level || "D",
                is_group || false,
                mob_desk || "D",
                sequence || 1,
                parent_id || null
            ]);

            createdEntries.push(result.rows[0]);
        }

        await client.query('COMMIT');
        return createdEntries;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    getAllNavigationEntries,
    createNavigationEntry,
    updateNavigationEntry,
    bulkCreateNavigationEntries
};

