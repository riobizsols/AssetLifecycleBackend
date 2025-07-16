const db = require("../config/db");

const getAllBranches = async () => {
  const result = await db.query('SELECT * FROM "tblBranches"');
  return result.rows;
};

const addBranch = async (branch) => {
  const { branch_id, ext_id, org_id, text, city, branch_code, created_by } =
    branch;

  const result = await db.query(
    `INSERT INTO "tblBranches" (
        branch_id, ext_id, org_id, text, city, branch_code, created_by, created_on
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
    [branch_id, ext_id, org_id, text, city, branch_code, created_by]
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

module.exports = {
  getAllBranches,
  addBranch,
  deleteBranches,
};
