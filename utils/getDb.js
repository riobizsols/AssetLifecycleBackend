/**
 * Shared utility function to get the correct database connection
 * This function should be used by all models to ensure they use the tenant database
 * when available, or fall back to the default database for normal users.
 * 
 * Usage in models:
 * const { getDb } = require('../utils/getDb');
 * const dbPool = getDb();
 * const result = await dbPool.query(...);
 */
const { getDbFromContext } = require('./dbContext');
const defaultDb = require('../config/db');

/**
 * Gets the appropriate database connection pool
 * - If a dbConnection is explicitly provided, use it
 * - Otherwise, check the async context (set by middleware for tenant users)
 * - Fall back to default database if no context is set
 * 
 * @param {object} dbConnection - Optional explicit database connection to use
 * @returns {object} PostgreSQL connection pool
 */
function getDb(dbConnection = null) {
  if (dbConnection) {
    return dbConnection;
  }
  
  // Try to get from async context (set by middleware for tenant users)
  const contextDb = getDbFromContext();
  
  // If context has a database, use it (tenant database)
  // Otherwise, use default database (normal users)
  return contextDb || defaultDb;
}

module.exports = { getDb };

