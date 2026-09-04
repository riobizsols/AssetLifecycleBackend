/**
 * Shared utility function to get the correct database connection.
 * Tenant-only: requires async context from auth middleware (runWithDb).
 */
const { getDbFromContext, tryGetDb } = require('./dbContext');

/**
 * Gets the tenant database connection pool from request context.
 * @param {object} dbConnection - Optional explicit database connection to use
 * @returns {object} PostgreSQL connection pool
 */
function getDb(dbConnection = null) {
  if (dbConnection) {
    return dbConnection;
  }

  return getDbFromContext();
}

module.exports = { getDb, tryGetDb };
