/**
 * Postgres SSL options for pg Pool/Client.
 * - ?sslmode=disable in the URL → never use SSL (local dev + Docker alm_db)
 * - DB_SSL=false|true overrides when set
 * - NODE_ENV=production enables SSL only when not disabled above and host is not local/Docker
 */

function pgSslOptions(connectionString) {
  if (!connectionString || typeof connectionString !== 'string') {
    return false;
  }

  const lower = connectionString.toLowerCase();

  if (
    lower.includes('sslmode=disable') ||
    lower.includes('ssl=false') ||
    process.env.DB_SSL === 'false' ||
    process.env.DATABASE_SSL === 'false'
  ) {
    return false;
  }

  if (process.env.DB_SSL === 'true' || process.env.DATABASE_SSL === 'true') {
    return { rejectUnauthorized: false };
  }

  if (/sslmode=(require|verify-full|verify-ca|prefer)/.test(lower)) {
    return { rejectUnauthorized: false };
  }

  if (process.env.NODE_ENV === 'production') {
    if (/@(localhost|127\.0\.0\.1|alm_db|host\.docker\.internal)(:|\/|$)/.test(lower)) {
      return false;
    }
    return { rejectUnauthorized: false };
  }

  return false;
}

function buildPoolConfig(connectionString, poolOptions = {}) {
  return {
    connectionString,
    ssl: pgSslOptions(connectionString),
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ...poolOptions,
  };
}

/**
 * pg-pool emits 'error' on idle clients; without a listener Node crashes the process.
 */
function attachPoolErrorHandler(pool, label = 'DB POOL') {
  if (!pool || pool.__almPoolErrorHandlerAttached) {
    return pool;
  }
  pool.__almPoolErrorHandlerAttached = true;
  pool.on('error', (err) => {
    console.error(`❌ [${label}] Idle client error:`, err?.message || err);
  });
  return pool;
}

module.exports = {
  pgSslOptions,
  buildPoolConfig,
  attachPoolErrorHandler,
};
