/**
 * Database Context Utility
 * 
 * Provides request-scoped database connection management for multi-tenancy.
 * Stores the tenant database connection in AsyncLocalStorage so all models
 * can access it without passing it through every function call.
 */

const { AsyncLocalStorage } = require('async_hooks');
const db = require('../config/db');

// Create async local storage for request context
const dbContext = new AsyncLocalStorage();

/**
 * Run a function with a database connection in context
 * @param {Object} dbConnection - The database connection (pool) to use
 * @param {Function} callback - Function to execute with the db connection in context
 */
function runWithDb(dbConnection, callback) {
  return dbContext.run(dbConnection, callback);
}

/**
 * Get the current database connection from context
 * Falls back to default database if no tenant connection is set
 * @returns {Object} Database connection pool
 */
function getDb() {
  const tenantDb = dbContext.getStore();
  return tenantDb || db;
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

