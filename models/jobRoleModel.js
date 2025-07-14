const db = require('../config/db');

const getJobRolesByOrg = async (ext_id, org_id) => {
    const result = await db.query(
        `SELECT job_role_id, text, job_function, int_status 
       FROM "tblJobRoles" 
       WHERE ext_id = $1 AND org_id = $2 AND int_status = 1`,
        [ext_id, org_id]
    );
    return result.rows;
};

const createJobRole = async (data) => {
    const { ext_id, org_id, job_role_id, text, job_function } = data;
    const result = await db.query(
        `INSERT INTO "tblJobRoles" 
       (ext_id, org_id, job_role_id, text, job_function, int_status)
       VALUES ($1, $2, $3, $4, $5, 1)
       RETURNING *`,
        [ext_id, org_id, job_role_id, text, job_function]
    );
    return result.rows[0];
};

module.exports = {
    getJobRolesByOrg,
    createJobRole,
};