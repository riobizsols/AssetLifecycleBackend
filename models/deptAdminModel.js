const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Get all departments
const getAllDepartments = async () => {
    const result = await db.query(`SELECT dept_id, text FROM "tblDepartments"`);
    return result.rows;
};

// Get department ID by name
const getDepartmentIdByName = async (deptName) => {
    const result = await db.query(`SELECT dept_id FROM "tblDepartments" WHERE text = $1`, [deptName]);
    return result.rows[0];
};

// Get all admins for a department
const getAdminsByDeptId = async (dept_id) => {
    const result = await db.query(
        `SELECT u.user_id, u.full_name AS name, u.email
         FROM "tblDeptAdmins" da
         JOIN "tblUsers" u ON da.user_id = u.user_id
         WHERE da.dept_id = $1`,
        [dept_id]
    );
    return result.rows;
};

// Get users in a department (to select as new admins)
const getUsersByDeptId = async (dept_id) => {
    const result = await db.query(`
    SELECT user_id, full_name, email
    FROM "tblUsers"
    WHERE dept_id = $1
  `, [dept_id]);
    return result.rows;
};

// Generate next business ID: DPTA001, DPTA002...
const getNextDeptAdminId = async () => {
    const res = await db.query(`SELECT id FROM "tblDeptAdmins" ORDER BY id DESC LIMIT 1`);
    let nextId = 'DPTA001';
    if (res.rows.length > 0) {
        const lastId = res.rows[0].id;
        const next = parseInt(lastId.replace('DPTA', ''), 10) + 1;
        nextId = `DPTA${String(next).padStart(3, '0')}`;
    }
    return nextId;
};

// Create a new department admin
const createDeptAdmin = async ({ dept_id, user_id, org_id, created_by }) => {
    const id = await getNextDeptAdminId();

    const result = await db.query(`
    INSERT INTO "tblDeptAdmins" (id, dept_id, user_id, org_id, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [id, dept_id, user_id, org_id, created_by]);

    return result.rows[0];
};

// Delete a department admin
const deleteDeptAdmin = async ({ dept_id, user_id }) => {
    await db.query(`DELETE FROM "tblDeptAdmins" WHERE dept_id = $1 AND user_id = $2`, [dept_id, user_id]);
};

module.exports = {
    getAllDepartments,
    getDepartmentIdByName,
    getAdminsByDeptId,
    getUsersByDeptId,
    createDeptAdmin,
    deleteDeptAdmin,
};
