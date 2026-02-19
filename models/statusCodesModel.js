const { getDbFromContext } = require("../utils/dbContext");

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

const getAllStatusCodes = async (dbPool) => {
  const db = dbPool || getDb();
  try {
    const result = await db.query(
      `
        SELECT id, status_code, text
        FROM "tblStatusCodes"
        ORDER BY id ASC
      `,
    );
    return result.rows;
  } catch (err) {
    // If table doesn't exist, return empty array (migration not run yet)
    if (err.code === "42P01") {
      // relation does not exist
      console.warn(
        "tblStatusCodes table does not exist. Please run migration: node migrations/createStatusCodesTableStandalone.js",
      );
      return [];
    }
    throw err;
  }
};

module.exports = {
  getAllStatusCodes,
};
