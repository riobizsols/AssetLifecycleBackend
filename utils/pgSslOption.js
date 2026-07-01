require('dotenv').config();

/**
 * Node-pg `ssl` option for Pool/Client.
 * Local Postgres often has no TLS; use DATABASE_SSL=false when NODE_ENV=production
 * but the server does not accept SSL (e.g. Docker Postgres on a dev machine).
 *
 * DATABASE_SSL=true  — force TLS ({ rejectUnauthorized: false }, typical for RDS-style hosts)
 * DATABASE_SSL=false — never use TLS for this process
 * (unset)            — TLS in production only, off in non-production (historical behavior)
 */
function getPgSslOption() {
  const raw = (process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') {
    return false;
  }
  if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') {
    return { rejectUnauthorized: false };
  }
  return process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
}

/** Connect timeout for `pg` Client (tenant setup, scripts). Pool uses its own config. */
function getPgClientConnectTimeoutMs() {
  const n = parseInt(process.env.PG_CLIENT_CONNECT_TIMEOUT_MS || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 30000;
}

/**
 * Parse postgresql:// URL (strips ?sslmode= etc. from database name).
 */
function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('Database URL is required');
  }
  const cleaned = databaseUrl.trim();
  try {
    const url = new URL(cleaned);
    const database = url.pathname.replace(/^\//, '').split('?')[0];
    if (!database) {
      throw new Error('Database name missing in URL');
    }
    return {
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database,
    };
  } catch (err) {
    const match = cleaned.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
    if (!match) {
      throw new Error(`Invalid database URL format: ${err.message}`);
    }
    return {
      user: decodeURIComponent(match[1]),
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: parseInt(match[4], 10),
      database: match[5],
    };
  }
}

/** pg Client options from a database URL (avoids ?sslmode= leaking into database name). */
function pgClientOptsFromDatabaseUrl(databaseUrl) {
  const { host, port, user, password, database } = parseDatabaseUrl(databaseUrl);
  return {
    host,
    port,
    user,
    password,
    database,
    ssl: getPgSslOption(),
    connectionTimeoutMillis: getPgClientConnectTimeoutMs(),
  };
}

module.exports = {
  getPgSslOption,
  getPgClientConnectTimeoutMs,
  parseDatabaseUrl,
  pgClientOptsFromDatabaseUrl,
};
