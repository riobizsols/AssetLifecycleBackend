const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// ✅ Fetch all departments — data scope from tblACM (via acm arg)
const getAllDepartments = async (org_id, branch_id, hasSuperAccess = false, acm = null) => {
    const dbPool = getDb();
    const { applyAcmSqlFilters } = require('../utils/acmAccess');

    let query = `
        SELECT DISTINCT
            d.*,
            bd.branch_id,
            b.text AS branch_name
        FROM "tblDepartments" d
        LEFT JOIN "tblBR_DEPT" bd ON bd.dept_id = d.dept_id AND bd.int_status = 1
        LEFT JOIN "tblBranches" b ON b.branch_id = bd.branch_id
        WHERE d.int_status = 1
    `;
    const params = [];

    if (acm) {
        const filter = applyAcmSqlFilters(
            acm,
            { org: 'd.org_id', branch: 'bd.branch_id', dept: 'd.dept_id' },
            params.length + 1
        );
        query += filter.sql;
        params.push(...filter.params);
    } else if (!hasSuperAccess) {
        params.push(org_id);
        query += ` AND d.org_id = $${params.length}`;
        if (branch_id) {
            params.push(branch_id);
            query += ` AND bd.branch_id = $${params.length}`;
        }
    }

    query += ` ORDER BY d.dept_id`;

    const result = await dbPool.query(query, params);
    return result.rows;
};

// Check if department is referenced by other tables
const checkDepartmentReferences = async (dept_id) => {
    try {
        const employeesQuery = `
            SELECT COUNT(*) as employee_count 
            FROM "tblEmployees" 
            WHERE dept_id = $1
        `;
        const dbPool = getDb();
        const employeesResult = await dbPool.query(employeesQuery, [dept_id]);
        const employeeCount = parseInt(employeesResult.rows[0].employee_count);

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
        const references = await checkDepartmentReferences(dept_id);
        if (references.totalReferences > 0) {
            throw new Error(`Cannot delete department ${dept_id} - it is referenced by ${references.employeeCount} employee(s)`);
        }

        const dbPool = getDb();
        // tblBR_DEPT cascades on dept delete; clear explicitly for clarity
        await dbPool.query(`DELETE FROM "tblBR_DEPT" WHERE dept_id = $1`, [dept_id]);
        const result = await dbPool.query(
            `DELETE FROM "tblDepartments" WHERE org_id = $1 AND dept_id = $2`,
            [org_id, dept_id]
        );
        return result.rowCount;
    } catch (error) {
        console.error('Error in deleteDepartment:', error);
        throw error;
    }
};

// ✅ Create a department (no branch_id on tblDepartments)
const createDepartment = async (dept) => {
    const {
        org_id,
        dept_id,
        int_status = 1,
        text,
        parent_id = null,
        created_by,
        changed_by = null
    } = dept;

    const dbPool = getDb();
    const result = await dbPool.query(
        `INSERT INTO "tblDepartments" (
      org_id, dept_id, int_status, text, parent_id,
      created_on, changed_on, created_by, changed_by
    ) VALUES (
      $1, $2, $3, $4, $5,
      CURRENT_DATE, CURRENT_DATE, $6, $7
    ) RETURNING *`,
        [
            org_id,
            dept_id,
            int_status,
            text,
            parent_id,
            created_by,
            changed_by
        ]
    );

    return result.rows[0];
};

// Map department to branch in tblBR_DEPT
const mapDepartmentToBranch = async ({ branch_id, dept_id, org_id, created_by = null }) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `INSERT INTO "tblBR_DEPT" (
            branch_id, dept_id, org_id, int_status, created_by, created_on, changed_on
         ) VALUES ($1, $2, $3, 1, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (branch_id, dept_id) DO UPDATE
           SET int_status = 1,
               org_id = EXCLUDED.org_id,
               changed_by = EXCLUDED.created_by,
               changed_on = CURRENT_TIMESTAMP
         RETURNING *`,
        [branch_id, dept_id, org_id, created_by]
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
    mapDepartmentToBranch,
    deleteDepartment,
    updateDepartment
};
