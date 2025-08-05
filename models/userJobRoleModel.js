const db = require('../config/db');

// Get user's job role by user ID
const getUserJobRole = async (user_id) => {
    const result = await db.query(
        `SELECT ujr.user_id, ujr.job_role_id, jr.text as job_role_name, jr.job_function
         FROM "tblUserJobRoles" ujr
         JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
         WHERE ujr.user_id = $1`,
        [user_id]
    );
    return result.rows[0];
};

// Assign job role to user
const assignJobRoleToUser = async (user_id, job_role_id, assigned_by) => {
    const result = await db.query(
        `INSERT INTO "tblUserJobRoles" 
         (user_id, job_role_id, assigned_by, assigned_on, int_status)
         VALUES ($1, $2, $3, CURRENT_DATE, 1)
         ON CONFLICT (user_id) 
         DO UPDATE SET 
             job_role_id = $2,
             assigned_by = $3,
             assigned_on = CURRENT_DATE,
             int_status = 1
         RETURNING *`,
        [user_id, job_role_id, assigned_by]
    );
    return result.rows[0];
};

// Update user's job role
const updateUserJobRole = async (user_id, job_role_id, updated_by) => {
    const result = await db.query(
        `UPDATE "tblUserJobRoles" 
         SET job_role_id = $2, 
             updated_by = $3, 
             updated_on = CURRENT_DATE
         WHERE user_id = $1
         RETURNING *`,
        [user_id, job_role_id, updated_by]
    );
    return result.rows[0];
};

// Get all users with their job roles
const getAllUsersWithJobRoles = async () => {
    const result = await db.query(
        `SELECT u.user_id, u.full_name, u.email, ujr.job_role_id, jr.text as job_role_name
         FROM "tblUsers" u
         LEFT JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id AND ujr.int_status = 1
         LEFT JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
         WHERE u.int_status = 1
         ORDER BY u.full_name`
    );
    return result.rows;
};

module.exports = {
    getUserJobRole,
    assignJobRoleToUser,
    updateUserJobRole,
    getAllUsersWithJobRoles
}; 