const db = require("../config/db");

const getAllOrganizations = async () => {
  const result = await db.query(`SELECT * FROM "tblOrgs" ORDER BY org_id DESC`);
  return result.rows;
};

const addOrganization = async (org) => {
  const { org_id, org_code, text, org_city, int_status = 1, valid_from, valid_to } = org;

  const result = await db.query(
    `INSERT INTO "tblOrgs" (
        org_id, org_code, text, org_city, int_status, valid_from, valid_to
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [org_id, org_code, text, org_city, int_status, valid_from, valid_to]
  );

  return result.rows[0];
};

const updateOrganization = async (org) => {
  const { org_id, org_code, text, org_city } = org;

  const result = await db.query(
    `UPDATE "tblOrgs"
     SET org_code = $2,
         text = $3,
         org_city = $4
     WHERE org_id = $1
     RETURNING *`,
    [org_id, org_code, text, org_city]
  );

  return result.rows[0];
};

const deleteOrganizations = async (org_id = []) => {
  const result = await db.query(
    `DELETE FROM "tblOrgs" WHERE org_id = ANY($1::text[])`,
    [org_id]
  );
  return result.rowCount;
};

module.exports = {
  getAllOrganizations,
  addOrganization,
  updateOrganization,
  deleteOrganizations,
};
