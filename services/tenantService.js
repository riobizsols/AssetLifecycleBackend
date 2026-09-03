/**
 * Tenant Service
 * 
 * Manages multi-tenant database connections by looking up organization
 * database credentials from the main PostgreSQL tenant table.
 */

const { Client, Pool } = require('pg');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { buildPoolConfig, pgSslOptions, attachPoolErrorHandler } = require('../utils/pgSsl');
require('dotenv').config();

// Tenant registry database connection (from TENANT_DATABASE_URL) - where tenant table lives
let tenantRegistryPool = null;

// Cached tenant DB pools — one pool per org (never create per request)
const tenantPools = new Map();

function tenantPoolMax() {
  const parsed = Number(process.env.TENANT_DB_POOL_MAX);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

function tenantRegistryPoolMax() {
  const parsed = Number(process.env.TENANT_REGISTRY_POOL_MAX);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function credentialsFingerprint(credentials) {
  return `${credentials.host}:${credentials.port}:${credentials.database}:${credentials.user}`;
}

async function evictTenantPool(orgId) {
  const entry = tenantPools.get(orgId);
  if (!entry) return;
  tenantPools.delete(orgId);
  try {
    await entry.pool.end();
  } catch {
    // pool may already be closed
  }
}

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
    tenantRegistryPool = new Pool(
      buildPoolConfig(connectionString, {
        max: tenantRegistryPoolMax(),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: parseInt(process.env.TENANT_REGISTRY_CONNECT_TIMEOUT_MS || '15000', 10) || 15000,
      }),
    );
    attachPoolErrorHandler(tenantRegistryPool, 'TENANT REGISTRY POOL');
    // Ensure schema upgrades (grouped_org_id, org_name, email) exist
    ensureTenantsSchema(tenantRegistryPool).catch((err) => {
      logger.warn(`[TenantService] ensureTenantsSchema on init: ${err.message}`);
    });
  }
  return tenantRegistryPool;
}

let tenantsSchemaEnsured = false;

/**
 * Ensure tenants registry schema:
 * - rename org_id → grouped_org_id (internally generated ORG###)
 * - add org_name (UI organization name)
 * - add email if missing
 */
async function ensureTenantsSchema(pool = null) {
  if (tenantsSchemaEnsured) return;
  const registry = pool || initTenantRegistryPool();

  await registry.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenants'
      ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'org_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'grouped_org_id'
      ) THEN
        ALTER TABLE "tenants" RENAME COLUMN org_id TO grouped_org_id;
      END IF;
    END $$;
  `);

  await registry.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenants'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'org_name'
      ) THEN
        ALTER TABLE "tenants" ADD COLUMN org_name character varying(255);
      END IF;
    END $$;
  `);

  await registry.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenants'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'email'
      ) THEN
        ALTER TABLE "tenants" ADD COLUMN email character varying(320);
      END IF;
    END $$;
  `);

  await registry.query(`
    CREATE INDEX IF NOT EXISTS idx_tenants_grouped_org_id ON "tenants"(grouped_org_id)
  `).catch(() => {});
  await registry.query(`
    CREATE INDEX IF NOT EXISTS idx_tenants_org_name ON "tenants"(org_name)
  `).catch(() => {});
  await registry.query(`
    CREATE INDEX IF NOT EXISTS idx_tenants_email_lower
      ON "tenants" (LOWER(email))
      WHERE email IS NOT NULL
  `).catch(() => {});

  tenantsSchemaEnsured = true;
}

/** @deprecated Use ensureTenantsSchema */
async function ensureTenantsEmailColumn(pool = null) {
  return ensureTenantsSchema(pool);
}

/**
 * Next registry PK: ORG001, ORG002, ... based on existing grouped_org_id values.
 */
async function generateNextGroupedOrgId(pool = null) {
  const registry = pool || initTenantRegistryPool();
  await ensureTenantsSchema(registry);
  const result = await registry.query(`
    SELECT COALESCE(
      MAX(
        CASE
          WHEN grouped_org_id ~ '^ORG[0-9]+$'
          THEN CAST(SUBSTRING(grouped_org_id FROM 4) AS INTEGER)
          ELSE 0
        END
      ),
      0
    )::int AS max_num
    FROM "tenants"
  `);
  const next = (result.rows[0]?.max_num || 0) + 1;
  return `ORG${String(next).padStart(3, '0')}`;
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
 * Check if a tenant exists for the given grouped_org_id
 */
async function checkTenantExists(orgId) {
  const cacheService = require('./cacheService');
  const cacheKey = cacheService.buildKey('tenant', 'exists', orgId);
  const cached = await cacheService.get(cacheKey);
  if (cached !== null && cached !== undefined) {
    return !!cached.exists;
  }

  const pool = initTenantRegistryPool();
  await ensureTenantsSchema(pool);

  try {
    const result = await pool.query(
      `SELECT grouped_org_id FROM "tenants" WHERE grouped_org_id = $1 AND is_active = true`,
      [orgId]
    );
    const exists = result.rows.length > 0;
    await cacheService.set(cacheKey, { exists }, cacheService.getTenantExistsCacheTtlMs());
    return exists;
  } catch (error) {
    console.error('[TenantService] Error checking tenant existence:', error);
    // Cache negative result so unreachable tenant registry does not add ~2s to every API call
    await cacheService.set(cacheKey, { exists: false }, cacheService.getTenantExistsCacheTtlMs());
    return false;
  }
}

/**
 * Get tenant database credentials by grouped_org_id
 */
async function getTenantCredentials(orgId) {
  const cacheService = require('./cacheService');
  const cacheKey = cacheService.buildKey('tenant', 'credentials', orgId);
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  const pool = initTenantRegistryPool();
  await ensureTenantsSchema(pool);

  try {
    const result = await pool.query(
      `SELECT grouped_org_id, org_name, db_host, db_port, db_name, db_user, db_password, is_active
       FROM "tenants"
       WHERE grouped_org_id = $1 AND is_active = true`,
      [orgId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Tenant not found for grouped_org_id: ${orgId}`);
    }

    const tenant = result.rows[0];
    const decryptedPassword = decryptPassword(tenant.db_password);

    const credentials = {
      orgId: tenant.grouped_org_id,
      orgName: tenant.org_name || null,
      host: tenant.db_host,
      port: tenant.db_port,
      database: tenant.db_name,
      user: tenant.db_user,
      password: decryptedPassword,
    };
    await cacheService.set(cacheKey, credentials, cacheService.getTenantExistsCacheTtlMs());
    return credentials;
  } catch (error) {
    console.error('[TenantService] Error getting tenant credentials:', error);
    throw error;
  }
}

/**
 * When the app reaches Postgres via Docker DNS (alm_db), rewrite public IPs
 * stored in the tenants registry so SSL/host resolution matches the registry URL.
 */
function resolveTenantDbHost(host) {
  const override = String(process.env.TENANT_DB_HOST_OVERRIDE || '').trim();
  if (override) return override;

  const registryUrl = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL || '';
  if (/@alm_db([:/]|$)/i.test(registryUrl) && host && String(host).toLowerCase() !== 'alm_db') {
    return 'alm_db';
  }
  return host;
}

function tenantSslShouldDisable(connectionHost) {
  if (process.env.DB_SSL === 'false' || process.env.DATABASE_SSL === 'false') {
    return true;
  }
  const urls = [process.env.TENANT_DATABASE_URL, process.env.DATABASE_URL, process.env.GENERIC_URL]
    .filter(Boolean)
    .map((u) => String(u).toLowerCase());
  if (urls.some((u) => u.includes('sslmode=disable') || u.includes('ssl=false'))) {
    return true;
  }
  const h = String(connectionHost || '').toLowerCase();
  return h === 'alm_db' || h === 'localhost' || h === '127.0.0.1' || h === 'host.docker.internal';
}

/**
 * Create connection string for tenant database.
 * Appends sslmode=disable when SSL is off (Docker alm_db / non-TLS Postgres).
 */
function getTenantConnectionString(credentials) {
  const host = resolveTenantDbHost(credentials.host);
  const base = `postgresql://${credentials.user}:${encodeURIComponent(credentials.password)}@${host}:${credentials.port}/${credentials.database}`;

  const lower = base.toLowerCase();
  if (lower.includes('sslmode=')) {
    return base;
  }

  if (tenantSslShouldDisable(host)) {
    return `${base}?sslmode=disable`;
  }

  return base;
}

/**
 * Get a database connection pool for a specific tenant
 */
async function getTenantPool(orgId) {
  if (!orgId) {
    throw new Error('org_id is required');
  }

  const credentials = await getTenantCredentials(orgId);
  const fingerprint = credentialsFingerprint(credentials);

  const existing = tenantPools.get(orgId);
  if (existing && existing.fingerprint === fingerprint) {
    logger.log(`[TenantService] Using cached pool for org_id: ${orgId}`);
    return existing.pool;
  }

  if (existing) {
    await evictTenantPool(orgId);
  }

  const connectionString = getTenantConnectionString(credentials);
  logger.log(`[TenantService] Creating pool for org_id: ${orgId}, database: ${credentials.database}`);

  const pool = new Pool(
    buildPoolConfig(connectionString, {
      max: tenantPoolMax(),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: parseInt(process.env.TENANT_CONNECT_TIMEOUT_MS || '5000', 10) || 5000,
    }),
  );
  attachPoolErrorHandler(pool, `TENANT POOL ${orgId}`);

  try {
    const testClient = await pool.connect();
    await testClient.query('SELECT 1');
    testClient.release();
  } catch (testError) {
    await pool.end().catch(() => {});
    logger.error(`[TenantService] Pool connection test failed for org_id ${orgId}:`, testError);
    throw new Error(`Failed to connect to tenant database: ${testError.message}`);
  }

  tenantPools.set(orgId, { pool, fingerprint });
  logger.log(`[TenantService] Created and cached pool for org_id: ${orgId}`);
  return pool;
}

/**
 * Get a database client for a specific tenant (for transactions)
 */
async function getTenantClient(orgId) {
  const credentials = await getTenantCredentials(orgId);
  const connectionString = getTenantConnectionString(credentials);

  const client = new Client({
    connectionString,
    ssl: pgSslOptions(connectionString),
  });

  await client.connect();
  return client;
}

/**
 * Register a new tenant in the tenant table
 * @param {string} groupedOrgId - Internally generated ORG### (registry PK)
 * @param {object} dbConfig - host/port/database/user/password/subdomain/email/orgName
 */
async function registerTenant(groupedOrgId, dbConfig) {
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
    // Organization admin email — used for org management / account deletion
    const email = dbConfig.email ? String(dbConfig.email).trim().toLowerCase() : null;
    const orgName = dbConfig.orgName ? String(dbConfig.orgName).trim() : null;

    try {
      await ensureTenantsSchema(pool);
    } catch (colErr) {
      logger.warn(`[TenantService] Could not ensure tenants schema: ${colErr.message}`);
    }

    if (hasSubdomainColumn && subdomain) {
      await pool.query(
        `INSERT INTO "tenants" (grouped_org_id, org_name, db_host, db_port, db_name, db_user, db_password, subdomain, email, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
         ON CONFLICT (grouped_org_id) DO UPDATE
         SET org_name = COALESCE(EXCLUDED.org_name, "tenants".org_name),
             db_host = EXCLUDED.db_host,
             db_port = EXCLUDED.db_port,
             db_name = EXCLUDED.db_name,
             db_user = EXCLUDED.db_user,
             db_password = EXCLUDED.db_password,
             subdomain = EXCLUDED.subdomain,
             email = COALESCE(EXCLUDED.email, "tenants".email),
             updated_at = CURRENT_TIMESTAMP,
             is_active = true`,
        [
          groupedOrgId,
          orgName,
          dbConfig.host,
          dbConfig.port || 5432,
          dbConfig.database,
          dbConfig.user,
          encryptedPassword,
          subdomain,
          email,
        ]
      );
      logger.log(`[TenantService] Registered tenant: ${groupedOrgId} (${orgName || 'n/a'}) -> ${dbConfig.database} with subdomain: ${subdomain}`);
    } else {
      await pool.query(
        `INSERT INTO "tenants" (grouped_org_id, org_name, db_host, db_port, db_name, db_user, db_password, email, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (grouped_org_id) DO UPDATE
         SET org_name = COALESCE(EXCLUDED.org_name, "tenants".org_name),
             db_host = EXCLUDED.db_host,
             db_port = EXCLUDED.db_port,
             db_name = EXCLUDED.db_name,
             db_user = EXCLUDED.db_user,
             db_password = EXCLUDED.db_password,
             email = COALESCE(EXCLUDED.email, "tenants".email),
             updated_at = CURRENT_TIMESTAMP,
             is_active = true`,
        [
          groupedOrgId,
          orgName,
          dbConfig.host,
          dbConfig.port || 5432,
          dbConfig.database,
          dbConfig.user,
          encryptedPassword,
          email,
        ]
      );
      logger.log(`[TenantService] Registered tenant: ${groupedOrgId} (${orgName || 'n/a'}) -> ${dbConfig.database}`);
    }

    await evictTenantPool(groupedOrgId);
    const cacheService = require('./cacheService');
    await cacheService.del(cacheService.buildKey('tenant', 'credentials', groupedOrgId));
    await cacheService.del(cacheService.buildKey('tenant', 'exists', groupedOrgId));

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
       WHERE grouped_org_id = $6`,
      [
        dbConfig.host,
        dbConfig.port || 5432,
        dbConfig.database,
        dbConfig.user,
        encryptedPassword,
        orgId,
      ]
    );

    await evictTenantPool(orgId);
    const cacheService = require('./cacheService');
    await cacheService.del(cacheService.buildKey('tenant', 'credentials', orgId));

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
       WHERE grouped_org_id = $1`,
      [orgId]
    );

    await evictTenantPool(orgId);
    const cacheService = require('./cacheService');
    await cacheService.del(cacheService.buildKey('tenant', 'credentials', orgId));
    await cacheService.del(cacheService.buildKey('tenant', 'exists', orgId));

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
      ssl: pgSslOptions(getTenantConnectionString(credentials)),
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
    evictTenantPool(orgId).catch((err) => {
      logger.error(`[TenantService] Error evicting pool for org_id ${orgId}:`, err);
    });
    logger.log(`[TenantService] Cleared pool cache for org_id: ${orgId}`);
    return;
  }

  Promise.all([...tenantPools.keys()].map((id) => evictTenantPool(id))).catch((err) => {
    logger.error('[TenantService] Error clearing all tenant pools:', err);
  });
  logger.log('[TenantService] Cleared all tenant pool caches');
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
  ensureTenantsEmailColumn,
  ensureTenantsSchema,
  generateNextGroupedOrgId,
};

