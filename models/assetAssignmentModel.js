const db = require("../config/db");

const getAllAssetAssignments = async () => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, employee_id, asset_id, effective_date,
            return_date, status, created_by, created_on, changed_by, changed_on, org_id
        FROM "tblAssetAssignments"
        ORDER BY created_on DESC
    `;

  return await db.query(query);
};

const getAssetAssignmentById = async (asset_assign_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, employee_id, asset_id, effective_date,
            return_date, status, created_by, created_on, changed_by, changed_on, org_id
        FROM "tblAssetAssignments"
        WHERE asset_assign_id = $1
    `;

  return await db.query(query, [asset_assign_id]);
};

const getAssetAssignmentsByDept = async (dept_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, employee_id, asset_id, effective_date,
            return_date, status, created_by, created_on, changed_by, changed_on, org_id
        FROM "tblAssetAssignments"
        WHERE dept_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [dept_id]);
};

const getAssetAssignmentsByEmployee = async (employee_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, employee_id, asset_id, effective_date,
            return_date, status, created_by, created_on, changed_by, changed_on, org_id
        FROM "tblAssetAssignments"
        WHERE employee_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [employee_id]);
};

const getAssetAssignmentsByAsset = async (asset_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, employee_id, asset_id, effective_date,
            return_date, status, created_by, created_on, changed_by, changed_on, org_id
        FROM "tblAssetAssignments"
        WHERE asset_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [asset_id]);
};

const getAssetAssignmentsByStatus = async (status) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, employee_id, asset_id, effective_date,
            return_date, status, created_by, created_on, changed_by, changed_on, org_id
        FROM "tblAssetAssignments"
        WHERE status = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [status]);
};

const getAssetAssignmentsByOrg = async (org_id) => {
  const query = `
        SELECT 
            asset_assign_id, dept_id, employee_id, asset_id, effective_date,
            return_date, status, created_by, created_on, changed_by, changed_on, org_id
        FROM "tblAssetAssignments"
        WHERE org_id = $1
        ORDER BY created_on DESC
    `;

  return await db.query(query, [org_id]);
};

const getAssetAssignmentWithDetails = async (asset_assign_id) => {
  const query = `
        SELECT 
            aa.asset_assign_id, aa.dept_id, aa.employee_id, aa.asset_id, aa.effective_date,
            aa.return_date, aa.status, aa.created_by, aa.created_on, aa.changed_by, aa.changed_on, aa.org_id,
            d.text as dept_name,
            u.text as employee_name,
            a.text as asset_name,
            o.text as org_name
        FROM "tblAssetAssignments" aa
        LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
        LEFT JOIN "tblUsers" u ON aa.employee_id = u.user_id
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
    employee_id,
    asset_id,
    effective_date,
    return_date,
    status,
    org_id,
    created_by,
  } = assignmentData;

  const query = `
        INSERT INTO "tblAssetAssignments" (
            asset_assign_id, dept_id, employee_id, asset_id, effective_date,
            return_date, status, org_id, created_by, created_on, changed_by, changed_on
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $9, CURRENT_TIMESTAMP)
        RETURNING *
    `;

  const values = [
    asset_assign_id,
    dept_id,
    employee_id,
    asset_id,
    effective_date,
    return_date,
    status,
    org_id,
    created_by,
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
        WHERE asset_id = $1 AND employee_id = $2 AND org_id = $3 AND status = 'Active'
    `;

  return await db.query(query, [asset_id, employee_id, org_id]);
};

const updateAssetAssignment = async (asset_assign_id, updateData) => {
  const {
    dept_id,
    employee_id,
    asset_id,
    effective_date,
    return_date,
    status,
    org_id,
    changed_by,
  } = updateData;

  const query = `
        UPDATE "tblAssetAssignments"
        SET 
            dept_id = $2, employee_id = $3, asset_id = $4, effective_date = $5,
            return_date = $6, status = $7, org_id = $8, changed_by = $9, changed_on = CURRENT_TIMESTAMP
        WHERE asset_assign_id = $1
        RETURNING *
    `;

  const values = [
    asset_assign_id,
    dept_id,
    employee_id,
    asset_id,
    effective_date,
    return_date,
    status,
    org_id,
    changed_by,
  ];

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
  getAssetAssignmentWithDetails,
  insertAssetAssignment,
  checkAssetAssignmentExists,
  checkActiveAssignmentExists,
  updateAssetAssignment,
  deleteAssetAssignment,
  deleteMultipleAssetAssignments,
};
