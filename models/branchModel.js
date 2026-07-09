const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

const getAllBranches = async (org_id) => {
  const dbPool = getDb();
  const result = await dbPool.query('SELECT * FROM "tblBranches" WHERE org_id = $1', [org_id]);
  return result.rows;
};

const addBranch = async (branch) => {
  const { branch_id, org_id, text, city, branch_code, created_by } =
    branch;

  const dbPool = getDb();

  const payload = {
    branch_id,
    org_id,
    int_status: 1,
    text,
    city,
    branch_code,
    created_by: created_by || "SYSTEM",
    created_on: new Date(),
    changed_by: created_by || "SYSTEM",
    changed_on: new Date(),
  };

  // Defensive check: ensure all NOT NULL columns without defaults are populated.
  // This prevents runtime 500s if schema evolves.
  const requiredColsResult = await dbPool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'tblBranches'
       AND is_nullable = 'NO'
       AND column_default IS NULL`
  );
  const missing = requiredColsResult.rows
    .map((r) => r.column_name)
    .filter((col) => payload[col] === null || payload[col] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Missing required branch fields: ${missing.join(", ")}`
    );
  }

  const result = await dbPool.query(
    `INSERT INTO "tblBranches" (
        branch_id, org_id, int_status, text, city, branch_code, created_by, created_on, changed_by, changed_on
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
    [
      payload.branch_id,
      payload.org_id,
      payload.int_status,
      payload.text,
      payload.city,
      payload.branch_code,
      payload.created_by,
      payload.created_on,
      payload.changed_by,
      payload.changed_on,
    ]
  );

  return result.rows[0];
};

const deleteBranches = async (ids = []) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `DELETE FROM "tblBranches" WHERE branch_id = ANY($1::text[])`,
    [ids]
  );
  return result.rowCount;
};

const updateBranch = async (branch_id, data, changed_by) => {
  const { text, city, branch_code } = data;
  
  const dbPool = getDb();
  const result = await dbPool.query(
    `UPDATE "tblBranches" 
     SET text = $1, 
         city = $2, 
         branch_code = $3,
         changed_by = $4,
         changed_on = CURRENT_TIMESTAMP
     WHERE branch_id = $5
     RETURNING *`,
    [text, city, branch_code, changed_by, branch_id]
  );

  return result.rows[0];
};

module.exports = {
  getAllBranches,
  addBranch,
  deleteBranches,
  updateBranch,
};
