const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


const getAllOrganizations = async () => {
  const dbPool = getDb();

  const result = await dbPool.query(`SELECT * FROM "tblOrgs" ORDER BY org_id DESC`);
  return result.rows;
};

const getOrganizationById = async (orgId) => {
  const dbPool = getDb();

  const result = await dbPool.query(`SELECT * FROM "tblOrgs" WHERE org_id = $1`, [orgId]);
  return result.rows[0];
};

const addOrganization = async (org) => {
  const { org_id, org_code, text, org_city, subdomain, int_status = 1, valid_from, valid_to } = org;

  const dbPool = getDb();

  // Check if subdomain column exists, if not, add it without subdomain
  const result = await dbPool.query(
    `INSERT INTO "tblOrgs" (
        org_id, org_code, text, org_city, ${subdomain ? 'subdomain, ' : ''}int_status, valid_from, valid_to
     ) VALUES ($1, $2, $3, $4, ${subdomain ? '$5, $6, $7, $8' : '$5, $6, $7'})
     RETURNING *`,
    subdomain 
      ? [org_id, org_code, text, org_city, subdomain, int_status, valid_from, valid_to]
      : [org_id, org_code, text, org_city, int_status, valid_from, valid_to]
  );

  return result.rows[0];
};

const updateOrganization = async (org) => {
  const { org_id, org_code, text, org_city } = org;

  const dbPool = getDb();


  const result = await dbPool.query(
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

const checkOrgReferences = async (org_id) => {
  try {
    // Check if organization is referenced by users
    const usersQuery = `
      SELECT COUNT(*) as user_count 
      FROM "tblUsers" 
      WHERE org_id = $1
    `;
    const dbPool = getDb();

    const usersResult = await dbPool.query(usersQuery, [org_id]);
    const userCount = parseInt(usersResult.rows[0].user_count);

    // Check if organization is referenced by other tables
    // Add more checks as needed for other tables that reference org_id
    
    return {
      userCount,
      totalReferences: userCount
    };
  } catch (error) {
    console.error('Error in checkOrgReferences:', error);
    throw error;
  }
};

const deleteOrganizations = async (org_id = []) => {
  try {
    // Check references before deletion
    for (const id of org_id) {
      const references = await checkOrgReferences(id);
      if (references.totalReferences > 0) {
        throw new Error(`Cannot delete organization ${id} - it is referenced by ${references.userCount} user(s)`);
      }
    }

    const dbPool = getDb();


    const result = await dbPool.query(
      `DELETE FROM "tblOrgs" WHERE org_id = ANY($1::text[])`,
      [org_id]
    );
    return result.rowCount;
  } catch (error) {
    console.error('Error in deleteOrganizations:', error);
    throw error;
  }
};

module.exports = {
  getAllOrganizations,
  getOrganizationById,
  addOrganization,
  updateOrganization,
  deleteOrganizations,
};
