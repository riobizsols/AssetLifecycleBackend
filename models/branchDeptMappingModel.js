const { getDbFromContext } = require('../utils/dbContext');

const getDb = () => getDbFromContext();

const listMappings = async ({ orgId = null, branchId = null } = {}) => {
  const dbPool = getDb();
  const params = [];
  let where = `WHERE COALESCE(bd.int_status, 1) = 1`;

  if (orgId) {
    params.push(orgId);
    where += ` AND COALESCE(bd.org_id, b.org_id, d.org_id) = $${params.length}`;
  }
  if (branchId) {
    params.push(branchId);
    where += ` AND bd.branch_id = $${params.length}`;
  }

  const result = await dbPool.query(
    `SELECT
        bd.branch_id,
        b.text AS branch_name,
        b.org_id AS branch_org_id,
        bd.dept_id,
        d.text AS dept_name,
        d.org_id AS dept_org_id,
        COALESCE(bd.org_id, b.org_id, d.org_id) AS org_id,
        o.text AS org_name,
        bd.int_status,
        bd.created_by,
        bd.created_on,
        bd.changed_by,
        bd.changed_on
     FROM "tblBR_DEPT" bd
     LEFT JOIN "tblBranches" b ON b.branch_id = bd.branch_id
     LEFT JOIN "tblDepartments" d ON d.dept_id = bd.dept_id
     LEFT JOIN "tblOrgs" o ON o.org_id = COALESCE(bd.org_id, b.org_id, d.org_id)
     ${where}
     ORDER BY COALESCE(bd.org_id, b.org_id), b.text, d.text`,
    params
  );
  return result.rows;
};

const createMapping = async ({ branch_id, dept_id, org_id, created_by = null }) => {
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

const deleteMapping = async ({ branch_id, dept_id }) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `DELETE FROM "tblBR_DEPT"
     WHERE branch_id = $1 AND dept_id = $2
     RETURNING *`,
    [branch_id, dept_id]
  );
  return result.rows[0] || null;
};

const getBranch = async (branchId) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `SELECT branch_id, text, org_id, int_status FROM "tblBranches" WHERE branch_id = $1`,
    [branchId]
  );
  return result.rows[0] || null;
};

const getDepartment = async (deptId) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `SELECT dept_id, text, org_id, int_status FROM "tblDepartments" WHERE dept_id = $1`,
    [deptId]
  );
  return result.rows[0] || null;
};

module.exports = {
  listMappings,
  createMapping,
  deleteMapping,
  getBranch,
  getDepartment,
};
