const db = require("../config/db");

const getAllBranches = async () => {
  const result = await db.query('SELECT * FROM "tblBranches"');
  return result.rows;
};

const addBranch = async (branch) => {
  const { branch_id, org_id, text, city, branch_code, created_by } =
    branch;

  const result = await db.query(
    `INSERT INTO "tblBranches" (
        branch_id, org_id, text, city, branch_code, created_by, created_on
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *`,
    [branch_id, org_id, text, city, branch_code, created_by]
  );

  return result.rows[0];
};

const deleteBranches = async (ids = []) => {
  const result = await db.query(
    `DELETE FROM "tblBranches" WHERE branch_id = ANY($1::text[])`,
    [ids]
  );
  return result.rowCount;
};

const updateBranch = async (branch_id, data, changed_by) => {
  const { text, city, branch_code } = data;
  
  const result = await db.query(
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
