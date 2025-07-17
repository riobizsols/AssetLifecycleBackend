const db = require('../config/db');

// Get all user job roles
const getAllUserJobRoles = async () => {
    try {
        const result = await db.query(`SELECT * FROM "tblUserJobRoles"`);
        return result.rows;
    } catch (error) {
        console.error('Database error in getAllUserJobRoles:', error);
        throw new Error(`Database error: ${error.message}`);
    }
};

// Get user job role by ID
const getUserJobRoleById = async (user_job_role_id) => {
    const result = await db.query(
        'SELECT * FROM "tblUserJobRoles" WHERE user_job_role_id = $1',
        [user_job_role_id]
    );
    return result.rows[0];
};

// Get user job roles by user_id
const getUserJobRolesByUserId = async (user_id) => {
    const result = await db.query(
        'SELECT * FROM "tblUserJobRoles" WHERE user_id = $1',
        [user_id]
    );
    return result.rows;
};

// Get user job roles by job_role_id
const getUserJobRolesByJobRoleId = async (job_role_id) => {
    const result = await db.query(
        'SELECT * FROM "tblUserJobRoles" WHERE job_role_id = $1',
        [job_role_id]
    );
    return result.rows;
};

// Create new user job role
const createUserJobRole = async ({
    user_job_role_id,
    user_id,
    job_role_id
}) => {
    const result = await db.query(
        `INSERT INTO "tblUserJobRoles" (
            user_job_role_id,
            user_id,
            job_role_id
        ) VALUES (
            $1, $2, $3
        ) RETURNING *`,
        [user_job_role_id, user_id, job_role_id]
    );

    return result.rows[0];
};

// Update user job role
const updateUserJobRole = async (user_job_role_id, fieldsToUpdate = {}) => {
    const keys = Object.keys(fieldsToUpdate);
    if (!keys.length) return;

    const setClause = keys.map((key, idx) => `${key} = $${idx + 2}`).join(", ");
    const values = [user_job_role_id, ...keys.map((key) => fieldsToUpdate[key])];

    const result = await db.query(
        `UPDATE "tblUserJobRoles" SET ${setClause} WHERE user_job_role_id = $1 RETURNING *`,
        values
    );

    return result.rows[0];
};

// Delete user job role by ID
const deleteUserJobRole = async (user_job_role_id) => {
    const result = await db.query(
        'DELETE FROM "tblUserJobRoles" WHERE user_job_role_id = $1 RETURNING *',
        [user_job_role_id]
    );
    return result.rows[0];
};

// Delete multiple user job roles
const deleteUserJobRoles = async (user_job_role_ids = []) => {
    if (!user_job_role_ids.length) return;

    const result = await db.query(
        `DELETE FROM "tblUserJobRoles" WHERE user_job_role_id = ANY($1::text[])`,
        [user_job_role_ids]
    );
    return result.rowCount; // number of rows deleted
};

// Check if user job role exists
const userJobRoleExists = async (user_job_role_id) => {
    const result = await db.query(
        'SELECT EXISTS(SELECT 1 FROM "tblUserJobRoles" WHERE user_job_role_id = $1)',
        [user_job_role_id]
    );
    return result.rows[0].exists;
};

// Check if user-job role combination exists
const userJobRoleCombinationExists = async (user_id, job_role_id) => {
    const result = await db.query(
        'SELECT EXISTS(SELECT 1 FROM "tblUserJobRoles" WHERE user_id = $1 AND job_role_id = $2)',
        [user_id, job_role_id]
    );
    return result.rows[0].exists;
};

module.exports = {
    getAllUserJobRoles,
    getUserJobRoleById,
    getUserJobRolesByUserId,
    getUserJobRolesByJobRoleId,
    createUserJobRole,
    updateUserJobRole,
    deleteUserJobRole,
    deleteUserJobRoles,
    userJobRoleExists,
    userJobRoleCombinationExists,
};
