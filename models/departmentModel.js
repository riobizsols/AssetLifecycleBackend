const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// ✅ Fetch all departments
// Supports super access users who can view all branches
const getAllDepartments = async (org_id, branch_id, hasSuperAccess = false) => {
    const dbPool = getDb();
    let query = 'SELECT * FROM "tblDepartments" WHERE int_status = 1 AND org_id = $1';
    const params = [org_id];
    
    // Apply branch filter only if user doesn't have super access
    if (!hasSuperAccess && branch_id) {
        query += ' AND branch_id = $2';
        params.push(branch_id);
    }
    
    const result = await dbPool.query(query, params);
    return result.rows;
};

// Check if department is referenced by other tables
const checkDepartmentReferences = async (dept_id) => {
    try {
        // Check if department is referenced by employees
        const employeesQuery = `
            SELECT COUNT(*) as employee_count 
            FROM "tblEmployees" 
            WHERE dept_id = $1
        `;
        const dbPool = getDb();
        const employeesResult = await dbPool.query(employeesQuery, [dept_id]);
        const employeeCount = parseInt(employeesResult.rows[0].employee_count);

        // Check if department is referenced by other tables
        // Add more checks as needed for other tables that reference dept_id
        
        return {
            employeeCount,
            totalReferences: employeeCount
        };
    } catch (error) {
        console.error('Error in checkDepartmentReferences:', error);
        throw error;
    }
};

// ✅ Delete a department (by org_id and dept_id)
const deleteDepartment = async (org_id, dept_id) => {
    try {
        // Check references before deletion
        const references = await checkDepartmentReferences(dept_id);
        if (references.totalReferences > 0) {
            throw new Error(`Cannot delete department ${dept_id} - it is referenced by ${references.employeeCount} employee(s)`);
        }

        const dbPool = getDb();
    const result = await dbPool.query(
            `DELETE FROM "tblDepartments" WHERE org_id = $1 AND dept_id = $2`,
            [org_id, dept_id]
        );
        return result.rowCount; // optional for success confirmation
    } catch (error) {
        console.error('Error in deleteDepartment:', error);
        throw error;
    }
};

// ✅ Create a department (with fallback defaults)
const createDepartment = async (dept) => {
    const {
        org_id,
        dept_id,
        int_status = 1,
        text,
        parent_id = null,
        branch_id = null,
        created_by,
        changed_by = null
    } = dept;

    const dbPool = getDb();
    const result = await dbPool.query(
        `INSERT INTO "tblDepartments" (
      org_id, dept_id, int_status, text, parent_id,
      branch_id, created_on, changed_on, created_by, changed_by
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, CURRENT_DATE, CURRENT_DATE, $7, $8
    ) RETURNING *`,
        [
            org_id,
            dept_id,
            int_status,
            text,
            parent_id,
            branch_id,
            created_by,
            changed_by
        ]
    );

    return result.rows[0];
};


const updateDepartment = async ({ dept_id, org_id, text, changed_by }) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `UPDATE "tblDepartments"
         SET text = $1,
             changed_by = $2,
             changed_on = CURRENT_DATE
         WHERE dept_id = $3 AND org_id = $4
         RETURNING *`,
        [text, changed_by, dept_id, org_id]
    );

    return result.rows[0];
};


module.exports = {
    getAllDepartments,
    createDepartment,
    deleteDepartment,
    updateDepartment
};
