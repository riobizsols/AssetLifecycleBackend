const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


const getJobRolesByOrg = async (org_id) => {
    const dbPool = getDb();

    const result = await dbPool.query(
        `SELECT job_role_id, text, job_function, int_status 
       FROM "tblJobRoles" 
       WHERE org_id = $1 AND int_status = 1`,
        [org_id]
    );
    return result.rows;
};

const createJobRole = async (data) => {
    const { org_id, job_role_id, text, job_function } = data;
    const dbPool = getDb();

    const result = await dbPool.query(
        `INSERT INTO "tblJobRoles" 
       (org_id, job_role_id, text, job_function, int_status)
       VALUES ($1, $2, $3, $4, 1)
       RETURNING *`,
        [org_id, job_role_id, text, job_function]
    );
    return result.rows[0];
};

module.exports = {
    getJobRolesByOrg,
    createJobRole,
};