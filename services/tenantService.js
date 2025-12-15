/**
 * Tenant Service
 * 
 * Manages multi-tenant database connections by looking up organization
 * database credentials from the main PostgreSQL tenant table.
 */

const { Client, Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

// Tenant registry database connection (from TENANT_DATABASE_URL) - where tenant table lives
let tenantRegistryPool = null;

/**
 * Initialize tenant registry database connection pool
 * Uses TENANT_DATABASE_URL if set, otherwise falls back to DATABASE_URL
 */
function initTenantRegistryPool() {
  if (!tenantRegistryPool) {
    const connectionString = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Neither TENANT_DATABASE_URL nor DATABASE_URL environment variable is set');
    }
    tenantRegistryPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return tenantRegistryPool;
}

/**
 * Encrypt password using AES-256
 */
function encryptPassword(password) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret-key', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt password
 */
function decryptPassword(encryptedPassword) {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret-key', 'salt', 32);
    const parts = encryptedPassword.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('[TenantService] Error decrypting password:', error);
    throw new Error('Failed to decrypt database password');
  }
}

/**
 * Check if a tenant exists for the given org_id
 */
async function checkTenantExists(orgId) {
  const pool = initTenantRegistryPool();
  
  try {
    const result = await pool.query(
      `SELECT org_id FROM "tenants" WHERE org_id = $1 AND is_active = true`,
      [orgId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[TenantService] Error checking tenant existence:', error);
    return false;
  }
}

/**
 * Get tenant database credentials by org_id
 */
async function getTenantCredentials(orgId) {
  const pool = initTenantRegistryPool();
  
  try {
    const result = await pool.query(
      `SELECT org_id, db_host, db_port, db_name, db_user, db_password, is_active
       FROM "tenants"
       WHERE org_id = $1 AND is_active = true`,
      [orgId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Tenant not found for org_id: ${orgId}`);
    }

    const tenant = result.rows[0];
    
    // Decrypt password
    const decryptedPassword = decryptPassword(tenant.db_password);

    return {
      orgId: tenant.org_id,
      host: tenant.db_host,
      port: tenant.db_port,
      database: tenant.db_name,
      user: tenant.db_user,
      password: decryptedPassword,
    };
  } catch (error) {
    console.error('[TenantService] Error getting tenant credentials:', error);
    throw error;
  }
}

/**
 * Create connection string for tenant database
 */
function getTenantConnectionString(credentials) {
  return `postgresql://${credentials.user}:${encodeURIComponent(credentials.password)}@${credentials.host}:${credentials.port}/${credentials.database}`;
}

/**
 * Get a database connection pool for a specific tenant
 */
// Cache for tenant pools to avoid recreating them
const tenantPoolCache = new Map();

async function getTenantPool(orgId) {
  if (!orgId) {
    throw new Error('org_id is required');
  }
  
  // Check cache first
  if (tenantPoolCache.has(orgId)) {
    const cachedPool = tenantPoolCache.get(orgId);
    // Verify pool is still valid by checking if it's ended
    if (!cachedPool.ended) {
      console.log(`[TenantService] ♻️ Using cached pool for org_id: ${orgId}`);
      return cachedPool;
    } else {
      // Pool was ended, remove from cache
      tenantPoolCache.delete(orgId);
      console.log(`[TenantService] ⚠️ Cached pool was ended, creating new one for org_id: ${orgId}`);
    }
  }
  
  console.log(`[TenantService] 🔍 Getting tenant pool for org_id: ${orgId}`);
  
  try {
    const credentials = await getTenantCredentials(orgId);
    console.log(`[TenantService] ✅ Got credentials for org_id: ${orgId}, database: ${credentials.database}`);
    
    // Validate credentials
    if (!credentials.host || !credentials.port || !credentials.database || !credentials.user) {
      throw new Error(`Invalid tenant credentials for org_id: ${orgId}`);
    }
    
    const connectionString = getTenantConnectionString(credentials);
    console.log(`[TenantService] 🔗 Connection string: postgresql://${credentials.user}@${credentials.host}:${credentials.port}/${credentials.database}`);

    const pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // Increased timeout for better reliability
      // Handle pool errors
      errorHandler: (err, client) => {
        console.error(`[TenantService] ❌ Pool error for org_id ${orgId}:`, err);
        // Remove from cache if pool has errors
        if (tenantPoolCache.has(orgId)) {
          tenantPoolCache.delete(orgId);
        }
      }
    });
    
    // Test the connection before caching
    try {
      const testClient = await pool.connect();
      await testClient.query('SELECT 1');
      testClient.release();
      console.log(`[TenantService] ✅ Pool connection test successful for org_id: ${orgId}`);
    } catch (testError) {
      console.error(`[TenantService] ❌ Pool connection test failed for org_id ${orgId}:`, testError);
      await pool.end(); // Clean up failed pool
      throw new Error(`Failed to connect to tenant database: ${testError.message}`);
    }
    
    // Cache the pool
    tenantPoolCache.set(orgId, pool);
    console.log(`[TenantService] ✅ Created and cached pool for org_id: ${orgId}`);
    
    return pool;
  } catch (error) {
    console.error(`[TenantService] ❌ Error creating pool for org_id ${orgId}:`, error);
    throw error;
  }
}

/**
 * Get a database client for a specific tenant (for transactions)
 */
async function getTenantClient(orgId) {
  const credentials = await getTenantCredentials(orgId);
  const connectionString = getTenantConnectionString(credentials);

  const client = new Client({
    connectionString,
  });

  await client.connect();
  return client;
}

/**
 * Register a new tenant in the tenant table
 */
async function registerTenant(orgId, dbConfig) {
  const pool = initTenantRegistryPool();

  try {
    // Encrypt password
    const encryptedPassword = encryptPassword(dbConfig.password);

    // Check if subdomain column exists
    const subdomainColumnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenants' 
          AND column_name = 'subdomain'
      )
    `);
    
    const hasSubdomainColumn = subdomainColumnCheck.rows[0].exists;
    const subdomain = dbConfig.subdomain || null;

    if (hasSubdomainColumn && subdomain) {
      await pool.query(
        `INSERT INTO "tenants" (org_id, db_host, db_port, db_name, db_user, db_password, subdomain, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (org_id) DO UPDATE
         SET db_host = EXCLUDED.db_host,
             db_port = EXCLUDED.db_port,
             db_name = EXCLUDED.db_name,
             db_user = EXCLUDED.db_user,
             db_password = EXCLUDED.db_password,
             subdomain = EXCLUDED.subdomain,
             updated_at = CURRENT_TIMESTAMP,
             is_active = true`,
        [
          orgId,
          dbConfig.host,
          dbConfig.port || 5432,
          dbConfig.database,
          dbConfig.user,
          encryptedPassword,
          subdomain,
        ]
      );
      console.log(`[TenantService] Registered tenant: ${orgId} -> ${dbConfig.database} with subdomain: ${subdomain}`);
    } else {
      await pool.query(
        `INSERT INTO "tenants" (org_id, db_host, db_port, db_name, db_user, db_password, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (org_id) DO UPDATE
         SET db_host = EXCLUDED.db_host,
             db_port = EXCLUDED.db_port,
             db_name = EXCLUDED.db_name,
             db_user = EXCLUDED.db_user,
             db_password = EXCLUDED.db_password,
             updated_at = CURRENT_TIMESTAMP,
             is_active = true`,
        [
          orgId,
          dbConfig.host,
          dbConfig.port || 5432,
          dbConfig.database,
          dbConfig.user,
          encryptedPassword,
        ]
      );
      console.log(`[TenantService] Registered tenant: ${orgId} -> ${dbConfig.database}`);
    }

    return true;
  } catch (error) {
    console.error('[TenantService] Error registering tenant:', error);
    throw error;
  }
}

/**
 * Update tenant credentials
 */
async function updateTenant(orgId, dbConfig) {
  const pool = initTenantRegistryPool();

  try {
    const encryptedPassword = encryptPassword(dbConfig.password);

    await pool.query(
      `UPDATE "tenants"
       SET db_host = $1,
           db_port = $2,
           db_name = $3,
           db_user = $4,
           db_password = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE org_id = $6`,
      [
        dbConfig.host,
        dbConfig.port || 5432,
        dbConfig.database,
        dbConfig.user,
        encryptedPassword,
        orgId,
      ]
    );

    return true;
  } catch (error) {
    console.error('[TenantService] Error updating tenant:', error);
    throw error;
  }
}

/**
 * Deactivate a tenant
 */
async function deactivateTenant(orgId) {
  const pool = initTenantRegistryPool();

  try {
    await pool.query(
      `UPDATE "tenants"
       SET is_active = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE org_id = $1`,
      [orgId]
    );

    // Clear the pool cache since tenant is deactivated
    clearTenantPoolCache(orgId);

    return true;
  } catch (error) {
    console.error('[TenantService] Error deactivating tenant:', error);
    throw error;
  }
}

/**
 * Test tenant database connection
 */
async function testTenantConnection(orgId) {
  try {
    const credentials = await getTenantCredentials(orgId);
    const client = new Client({
      connectionString: getTenantConnectionString(credentials),
    });

    await client.connect();
    const result = await client.query('SELECT version()');
    await client.end();

    return {
      connected: true,
      serverVersion: result.rows[0].version,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * Clear tenant pool cache (useful when tenant credentials are updated)
 * @param {string} orgId - Optional org_id to clear specific pool, or null to clear all
 */
function clearTenantPoolCache(orgId = null) {
  if (orgId) {
    const pool = tenantPoolCache.get(orgId);
    if (pool && !pool.ended) {
      pool.end().catch(err => {
        console.error(`[TenantService] Error ending pool for org_id ${orgId}:`, err);
      });
    }
    tenantPoolCache.delete(orgId);
    console.log(`[TenantService] 🗑️ Cleared pool cache for org_id: ${orgId}`);
  } else {
    // Clear all pools
    for (const [cachedOrgId, pool] of tenantPoolCache.entries()) {
      if (pool && !pool.ended) {
        pool.end().catch(err => {
          console.error(`[TenantService] Error ending pool for org_id ${cachedOrgId}:`, err);
        });
      }
    }
    tenantPoolCache.clear();
    console.log(`[TenantService] 🗑️ Cleared all pool caches`);
  }
}

module.exports = {
  checkTenantExists,
  getTenantCredentials,
  getTenantPool,
  getTenantClient,
  getTenantConnectionString,
  registerTenant,
  updateTenant,
  deactivateTenant,
  testTenantConnection,
  initTenantRegistryPool,
  clearTenantPoolCache,
};

