/**
 * Database Context Utility
 *
 * Provides request-scoped database connection management for multi-tenancy.
 * Authenticated requests must run inside runWithDb(tenantPool) — no default DATABASE_URL fallback.
 */

const { AsyncLocalStorage } = require('async_hooks');

// Create async local storage for request context
const dbContext = new AsyncLocalStorage();

class TenantDbContextError extends Error {
    constructor(message = 'Tenant database context is required') {
        super(message);
        this.name = 'TenantDbContextError';
        this.code = 'TENANT_DB_CONTEXT_REQUIRED';
    }
}

/**
 * Run a function with a database connection in context
 * @param {Object} dbConnection - The database connection (pool/proxy) to use
 * @param {Function} callback - Function to execute with the db connection in context
 */
function runWithDb(dbConnection, callback) {
  return dbContext.run(dbConnection, callback);
}

/**
 * Get tenant DB from context when present; null for background jobs (cron, startup) with no request scope.
 * @returns {Object|null}
 */
function tryGetDb() {
  const tenantDb = dbContext.getStore();
  if (!tenantDb || tenantDb.ending === true || typeof tenantDb.query !== 'function') {
    return null;
  }
  return tenantDb;
}

/**
 * Get the current tenant database connection from async context.
 * @returns {Object} PostgreSQL connection pool
 */
function getDb() {
  const tenantDb = tryGetDb();
  if (!tenantDb) {
    throw new TenantDbContextError();
  }
  return tenantDb;
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
  tryGetDb,
  getDbFromContext,
  isUsingTenantDb,
  dbContext,
  TenantDbContextError,
};

