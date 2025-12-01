const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

const { generateCustomId } = require('../utils/idGenerator');

// Get all departments
const getAllDepartments = async (org_id, branch_id) => {
    const dbPool = getDb();

    const result = await dbPool.query(`SELECT dept_id, text FROM "tblDepartments" WHERE int_status = 1 AND org_id = $1 AND branch_id = $2`, [org_id, branch_id]);
    return result.rows;
};

// Get department ID by name
const getDepartmentIdByName = async (deptName, org_id, branch_id) => {
    console.log('=== Department ID by Name Model Debug ===');
    console.log('deptName:', deptName);
    console.log('org_id:', org_id);
    console.log('branch_id:', branch_id);
    
    const dbPool = getDb();

    
    const result = await dbPool.query(`SELECT dept_id FROM "tblDepartments" WHERE text = $1 AND org_id = $2 AND branch_id = $3`, [deptName, org_id, branch_id]);
    console.log('Query executed successfully, found departments:', result.rows.length);
    return result.rows[0];
};

// Get all admins for a department
const getAdminsByDeptId = async (dept_id, org_id, branch_id) => {
    const dbPool = getDb();

    const result = await dbPool.query(
        `SELECT u.user_id, u.full_name AS name, u.email
         FROM "tblDeptAdmins" da
         JOIN "tblUsers" u ON da.user_id = u.user_id
         JOIN "tblDepartments" d ON da.dept_id = d.dept_id
         WHERE da.dept_id = $1 AND da.org_id = $2 
           AND (da.branch_id = $3 OR da.branch_id IS NULL)
           AND d.org_id = $2`,
        [dept_id, org_id, branch_id]
    );
    return result.rows;
};

// Get users in a department (to select as new admins)
const getUsersByDeptId = async (dept_id, org_id, branch_id) => {
    console.log('=== Department Users Model Debug ===');
    console.log('dept_id:', dept_id);
    console.log('org_id:', org_id);
    console.log('branch_id:', branch_id);
    
    const dbPool = getDb();

    
    const result = await dbPool.query(`
        SELECT u.user_id, u.full_name, u.email
        FROM "tblUsers" u
        JOIN "tblDepartments" d ON u.dept_id = d.dept_id
        WHERE u.dept_id = $1 AND u.org_id = $2 AND d.org_id = $2 AND d.branch_id = $3
    `, [dept_id, org_id, branch_id]);
    console.log('Query executed successfully, found users:', result.rows.length);
    return result.rows;
};

// Create a new department admin
const createDeptAdmin = async ({ dept_id, user_id, org_id, created_by }) => {
    const dept_admin_id = await generateCustomId("dept_admin", 3);

    const dbPool = getDb();


    const result = await dbPool.query(`
    INSERT INTO "tblDeptAdmins" (dept_admin_id, dept_id, user_id, org_id, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [dept_admin_id, dept_id, user_id, org_id, created_by]);

    return result.rows[0];
};

// Delete a department admin
const deleteDeptAdmin = async ({ dept_id, user_id }) => {
    await dbPool.query(`DELETE FROM "tblDeptAdmins" WHERE dept_id = $1 AND user_id = $2`, [dept_id, user_id]);
};

module.exports = {
    getAllDepartments,
    getDepartmentIdByName,
    getAdminsByDeptId,
    getUsersByDeptId,
    createDeptAdmin,
    deleteDeptAdmin,
};
