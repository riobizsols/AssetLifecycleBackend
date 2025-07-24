const db = require("../config/db");

const getAllAssetAssignments = async () => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        ORDER BY action_on DESC
    `;

  return await db.query(query);
};

const getAssetAssignmentById = async (asset_assign_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE asset_assign_id = $1
    `;

  return await db.query(query, [asset_assign_id]);
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

  return await db.query(query, [dept_id]);
};

const getAssetAssignmentsByEmployee = async (employee_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, asset_id, org_id, employee_int_id,
            action, action_on, action_by, latest_assignment_flag
        FROM "tblAssetAssignments"
        WHERE employee_int_id = $1
        ORDER BY action_on DESC
    `;

  return await db.query(query, [employee_id]);
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

  return await db.query(query, [asset_id]);
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

  return await db.query(query, [action]);
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

  return await db.query(query, [org_id]);
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

  return await db.query(query, [employee_id]);
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

  const employeeResult = await db.query(employeeQuery, [employee_id]);
  
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

  const assignmentsResult = await db.query(assignmentsQuery, [employee_id]);

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
            a.text as asset_name,
            o.text as org_name
        FROM "tblAssetAssignments" aa
        LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
        LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.employee_id
        LEFT JOIN "tblAssets" a ON aa.asset_id = a.asset_id
        LEFT JOIN "tblOrganizations" o ON aa.org_id = o.org_id
        WHERE aa.asset_assign_id = $1
    `;

  return await db.query(query, [asset_assign_id]);
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

  return await db.query(query, values);
};

const checkAssetAssignmentExists = async (asset_assign_id) => {
  const query = `
        SELECT asset_assign_id FROM "tblAssetAssignments"
        WHERE asset_assign_id = $1
    `;

  return await db.query(query, [asset_assign_id]);
};

const checkActiveAssignmentExists = async (asset_id, employee_id, org_id) => {
  const query = `
        SELECT asset_assign_id FROM "tblAssetAssignments"
        WHERE asset_id = $1 AND employee_int_id = $2 AND org_id = $3 AND latest_assignment_flag = true
    `;

  return await db.query(query, [asset_id, employee_id, org_id]);
};

const updateAssetAssignment = async (asset_assign_id, updateData) => {
  const {
    dept_id,
    asset_id,
    org_id,
    employee_int_id,
    action,
    action_by,
    latest_assignment_flag,
  } = updateData;

  const query = `
        UPDATE "tblAssetAssignments"
        SET 
            dept_id = $2, asset_id = $3, org_id = $4, employee_int_id = $5,
            action = $6, action_on = CURRENT_TIMESTAMP, action_by = $7, latest_assignment_flag = $8
        WHERE asset_assign_id = $1
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

  return await db.query(query, values);
};

const updateAssetAssignmentByAssetId = async (asset_id, latest_assignment_flag) => {
  const query = `
        UPDATE "tblAssetAssignments"
        SET latest_assignment_flag = $2
        WHERE asset_id = $1 AND action = 'A' AND latest_assignment_flag = true
        RETURNING *
    `;

  const values = [asset_id, latest_assignment_flag];

  return await db.query(query, values);
};

const deleteAssetAssignment = async (asset_assign_id) => {
  const query = `
        DELETE FROM "tblAssetAssignments"
        WHERE asset_assign_id = $1
        RETURNING *
    `;

  return await db.query(query, [asset_assign_id]);
};

const deleteMultipleAssetAssignments = async (asset_assign_ids) => {
  const query = `
        DELETE FROM "tblAssetAssignments"
        WHERE asset_assign_id = ANY($1::text[])
        RETURNING *
    `;

  return await db.query(query, [asset_assign_ids]);
};

module.exports = {
  getAllAssetAssignments,
  getAssetAssignmentById,
  getAssetAssignmentsByDept,
  getAssetAssignmentsByEmployee,
  getAssetAssignmentsByAsset,
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
};
