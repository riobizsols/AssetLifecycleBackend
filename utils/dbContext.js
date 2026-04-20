/**
 * Database Context Utility
 *
 * Provides request-scoped database connection management for multi-tenancy.
 * getDb() returns the proxy from config/db (never the raw pool), so callers
 * always get a live reference that forwards to the current pool — no stale refs after storm/reload.
 */

const { AsyncLocalStorage } = require('async_hooks');

// Create async local storage for request context
const dbContext = new AsyncLocalStorage();

/**
 * Run a function with a database connection in context
 * @param {Object} dbConnection - The database connection (pool/proxy) to use
 * @param {Function} callback - Function to execute with the db connection in context
 */
function runWithDb(dbConnection, callback) {
  return dbContext.run(dbConnection, callback);
}

/**
 * Get the current database connection from context.
 * Returns tenant pool if in context, otherwise the default from config/db (the proxy).
 * The proxy always forwards to the current pool, so no stale or ended reference.
 * @returns {Object} Database connection (proxy or tenant pool)
 */
function getDb() {
  const tenantDb = dbContext.getStore();
  if (tenantDb) {
    // Guard against leaked/ended pool references in async context.
    if (tenantDb.ending === true) {
      return require('../config/db');
    }
    if (typeof tenantDb.query === 'function') {
      return tenantDb;
    }
  }
  return require('../config/db'); // proxy; never the raw pool
}

/**
 * Alias for getDb() for backward compatibility
 * @returns {Object} Database connection pool
 */
function getDbFromContext() {
  return getDb();
}

/**
 * Check if we're using a tenant database
 * @returns {boolean}
 */
function isUsingTenantDb() {
  return dbContext.getStore() !== undefined;
}

module.exports = {
  runWithDb,
  getDb,
  getDbFromContext, // Alias for backward compatibility
  isUsingTenantDb,
  dbContext,
};

