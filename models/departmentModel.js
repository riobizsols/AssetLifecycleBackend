const db = require('../config/db');

// ✅ Fetch all departments
const getAllDepartments = async () => {
    const result = await db.query('SELECT * FROM "tblDepartments"');
    return result.rows;
};

// ✅ Delete a department (by org_id and dept_id)
const deleteDepartment = async (org_id, dept_id) => {
    const result = await db.query(
        `DELETE FROM "tblDepartments" WHERE org_id = $1 AND dept_id = $2`,
        [org_id, dept_id]
    );
    return result.rowCount; // optional for success confirmation
};

// ✅ Create a department (with fallback defaults)
const createDepartment = async (dept) => {
    const {
        ext_id,
        org_id,
        dept_id,
        int_status = 1,
        text,
        parent_id = null,
        branch_code = null,
        created_by,
        changed_by = null
    } = dept;

    const result = await db.query(
        `INSERT INTO "tblDepartments" (
      ext_id, org_id, dept_id, int_status, text, parent_id,
      branch_code, created_on, changed_on, created_by, changed_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, CURRENT_DATE, CURRENT_DATE, $8, $9
    ) RETURNING *`,
        [
            ext_id,
            org_id,
            dept_id,
            int_status,
            text,
            parent_id,
            branch_code,
            created_by,
            changed_by
        ]
    );

    return result.rows[0];
};


const updateDepartment = async ({ dept_id, org_id, text, changed_by }) => {
    const result = await db.query(
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
