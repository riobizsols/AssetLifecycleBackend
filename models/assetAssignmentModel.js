const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


const getAllAssetAssignments = async () => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        ORDER BY action_on DESC
    `;

  const dbPool = getDb();
  return await dbPool.query(query);
};

const getAssetAssignmentById = async (asset_assign_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE asset_assign_id = $1
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [asset_assign_id]);
};

const getAssetAssignmentsByDept = async (dept_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE dept_id = $1
        ORDER BY action_on DESC
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [dept_id]);
};

const getAssetAssignmentsByEmployee = async (employee_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE employee_int_id = $1 OR employee_int_id = (
            SELECT emp_int_id FROM "tblEmployees" 
            WHERE employee_id = $1
        )
        ORDER BY action_on DESC
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [employee_id]);
};

const getAssetAssignmentsByAsset = async (asset_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE asset_id = $1
        ORDER BY action_on DESC
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [asset_id]);
};

const getLatestAssetAssignment = async (asset_id) => {
  const query = `
        SELECT 
            aa.asset_assign_id, aa.dept_id, aa.asset_id, aa.org_id, aa.employee_int_id,
            aa.action, aa.action_on, aa.action_by, aa.latest_assignment_flag,
            e.employee_id, e.name as employee_name,
            u.user_id as employee_user_id, u.full_name as user_name, u.email
        FROM "tblAssetAssignments" aa
        LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
        LEFT JOIN "tblUsers" u ON e.emp_int_id = u.emp_int_id
        WHERE aa.asset_id = $1 
          AND aa.action = 'A' 
          AND aa.latest_assignment_flag = true
        ORDER BY aa.action_on DESC
        LIMIT 1
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [asset_id]);
};

const getAssetAssignmentsByStatus = async (action) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE action = $1
        ORDER BY action_on DESC
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [action]);
};

const getAssetAssignmentsByOrg = async (org_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE org_id = $1
        ORDER BY action_on DESC
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [org_id]);
};

const getActiveAssetAssignmentsByEmployee = async (employee_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE employee_int_id = $1 AND action = 'A' AND latest_assignment_flag = true
        ORDER BY action_on DESC
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [employee_id]);
};

const getActiveAssetAssignmentsByEmployeeWithDetails = async (employee_id) => {
  // First get employee and department details - search by both emp_int_id and employee_id
  const employeeQuery = `
        SELECT 
            e.emp_int_id, e.employee_id, e.name as employee_name, e.dept_id,
            d.text as department_name
        FROM "tblEmployees" e
        LEFT JOIN "tblDepartments" d ON e.dept_id = d.dept_id
        WHERE e.emp_int_id = $1 OR e.employee_id = $1
    `;

  const dbPool = getDb();
  const employeeResult = await dbPool.query(employeeQuery, [employee_id]);
  
  // Then get active asset assignments - search by both emp_int_id and employee_id
  const assignmentsQuery = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE (employee_int_id = $1 OR employee_int_id = (
            SELECT emp_int_id FROM "tblEmployees" 
            WHERE employee_id = $1
        ))
        AND action = 'A' AND latest_assignment_flag = true
        ORDER BY action_on DESC
    `;

  const assignmentsResult = await dbPool.query(assignmentsQuery, [employee_id]);

  return {
    employee: employeeResult.rows[0] || null,
    assignments: assignmentsResult.rows
  };
};

const getAssetAssignmentWithDetails = async (asset_assign_id) => {
  const query = `
        SELECT 
            aa.asset_assign_id, aa.dept_id, aa.asset_id, aa.org_id, aa.employee_int_id,
            aa.action, aa.action_on, aa.action_by, aa.latest_assignment_flag,
            d.text as dept_name,
            e.name as employee_name,
            a.text as asset_name
        FROM "tblAssetAssignments" aa
        LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
        LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.employee_id
        LEFT JOIN "tblAssets" a ON aa.asset_id = a.asset_id
        WHERE aa.asset_assign_id = $1
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [asset_assign_id]);
};

const insertAssetAssignment = async (assignmentData) => {
  const {
    asset_assign_id,
    dept_id,
    asset_id,
    org_id,
    employee_int_id,
    action,
    action_by,
    latest_assignment_flag,
  } = assignmentData;

  const query = `
        INSERT INTO "tblAssetAssignments" (
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, $7, $8)
        RETURNING *
    `;

  const values = [
    asset_assign_id,
    dept_id,
    asset_id,
    org_id,
    employee_int_id,
    action,
    action_by,
    latest_assignment_flag,
  ];

  const dbPool = getDb();
  return await dbPool.query(query, values);
};

const checkAssetAssignmentExists = async (asset_assign_id) => {
  const query = `
        SELECT asset_assign_id FROM "tblAssetAssignments"
        WHERE asset_assign_id = $1
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [asset_assign_id]);
};

const checkActiveAssignmentExists = async (asset_id, employee_id, org_id) => {
  const query = `
        SELECT asset_assign_id FROM "tblAssetAssignments"
        WHERE asset_id = $1 AND employee_int_id = $2 AND org_id = $3 AND latest_assignment_flag = true
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [asset_id, employee_id, org_id]);
};

const updateAssetAssignment = async (asset_assign_id, updateData) => {
  // Build SET clause and values dynamically
  const setClauses = [];
  const values = [asset_assign_id];
  let idx = 2;

  if (updateData.dept_id !== undefined) {
    setClauses.push(`dept_id = $${idx}`);
    values.push(updateData.dept_id);
    idx++;
  }
  if (updateData.asset_id !== undefined) {
    setClauses.push(`asset_id = $${idx}`);
    values.push(updateData.asset_id);
    idx++;
  }
  if (updateData.org_id !== undefined) {
    setClauses.push(`org_id = $${idx}`);
    values.push(updateData.org_id);
    idx++;
  }
  if (updateData.employee_int_id !== undefined) {
    setClauses.push(`employee_int_id = $${idx}`);
    values.push(updateData.employee_int_id);
    idx++;
  }
  if (updateData.action !== undefined) {
    setClauses.push(`action = $${idx}`);
    values.push(updateData.action);
    idx++;
  }
  // Always update action_on and action_by
  setClauses.push(`action_on = CURRENT_TIMESTAMP`);
  if (updateData.action_by !== undefined) {
    setClauses.push(`action_by = $${idx}`);
    values.push(updateData.action_by);
    idx++;
  }
  if (updateData.latest_assignment_flag !== undefined) {
    setClauses.push(`latest_assignment_flag = $${idx}`);
    values.push(updateData.latest_assignment_flag);
    idx++;
  }

  const setClause = setClauses.join(', ');
  const query = `
    UPDATE "tblAssetAssignments"
    SET ${setClause}
    WHERE asset_assign_id = $1
    RETURNING *
  `;

  const dbPool = getDb();
  return await dbPool.query(query, values);
};

const updateAssetAssignmentByAssetId = async (asset_id, latest_assignment_flag) => {
  const query = `
        UPDATE "tblAssetAssignments"
        SET latest_assignment_flag = $2
        WHERE asset_id = $1 AND action = 'A' AND latest_assignment_flag = true
        RETURNING *
    `;

  const values = [asset_id, latest_assignment_flag];

  const dbPool = getDb();
  return await dbPool.query(query, values);
};

const deleteAssetAssignment = async (asset_assign_id) => {
  const query = `
        DELETE FROM "tblAssetAssignments"
        WHERE asset_assign_id = $1
        RETURNING *
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [asset_assign_id]);
};

const deleteMultipleAssetAssignments = async (asset_assign_ids) => {
  const query = `
        DELETE FROM "tblAssetAssignments"
        WHERE asset_assign_id = ANY($1::text[])
        RETURNING *
    `;

  const dbPool = getDb();
  return await dbPool.query(query, [asset_assign_ids]);
};

const getDepartmentWiseAssetAssignments = async (dept_id, org_id, branch_id) => {
  // Get department details and employee count with org_id and branch_id filter
  const deptQuery = `
        SELECT 
            d.dept_id, d.text as department_name, d.org_id, d.branch_id,
            COUNT(DISTINCT e.employee_id) as employee_count
        FROM "tblDepartments" d
        LEFT JOIN "tblEmployees" e ON d.dept_id = e.dept_id
        WHERE d.dept_id = $1 AND d.org_id = $2 AND d.branch_id = $3
        GROUP BY d.dept_id, d.text, d.org_id, d.branch_id
    `;

  const dbPool = getDb();
  const deptResult = await dbPool.query(deptQuery, [dept_id, org_id, branch_id]);

  // Get assigned assets for department with org_id and branch_id filters
  const assignedAssetsQuery = `
        SELECT DISTINCT
            a.asset_id, a.text as asset_name, a.serial_number, a.description,
            a.asset_type_id, at.text as asset_type_name, at.assignment_type,
            aa.asset_assign_id, aa.action, aa.action_on, aa.action_by,
            aa.latest_assignment_flag
        FROM "tblAssets" a
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        INNER JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id
        WHERE aa.dept_id = $1 
        AND a.org_id = $2
        AND a.branch_id = $3
        AND aa.action = 'A' 
        AND aa.latest_assignment_flag = true
        ORDER BY a.text
    `;

  const assignedAssetsResult = await dbPool.query(assignedAssetsQuery, [dept_id, org_id, branch_id]);

  // Get employees for the department (filtered by org_id)
  const employeesQuery = `
        SELECT 
            e.employee_id, e.emp_int_id, e.name as employee_name, 
            e.email_id as email, e.phone_number as phone, e.employee_type as designation
        FROM "tblEmployees" e
        WHERE e.dept_id = $1 AND e.org_id = $2
        ORDER BY e.name
    `;

  const employeesResult = await dbPool.query(employeesQuery, [dept_id, org_id]);

  return {
    department: deptResult.rows[0] || null,
    assignedAssets: assignedAssetsResult.rows,
    employees: employeesResult.rows
  };
};

module.exports = {
  getAllAssetAssignments,
  getAssetAssignmentById,
  getAssetAssignmentsByDept,
  getAssetAssignmentsByEmployee,
  getAssetAssignmentsByAsset,
  getLatestAssetAssignment,
  getAssetAssignmentsByStatus,
  getAssetAssignmentsByOrg,
  getActiveAssetAssignmentsByEmployee,
  getActiveAssetAssignmentsByEmployeeWithDetails,
  getAssetAssignmentWithDetails,
  insertAssetAssignment,
  checkAssetAssignmentExists,
  checkActiveAssignmentExists,
  updateAssetAssignment,
  updateAssetAssignmentByAssetId,
  deleteAssetAssignment,
  deleteMultipleAssetAssignments,
  getDepartmentWiseAssetAssignments,
};
