require('dotenv').config();

/**
 * Node-pg `ssl` option for Pool/Client (tenant setup + scripts).
 *
 * Prefer the same rules as utils/pgSsl.js:
 * - DB_SSL / DATABASE_SSL = false → never TLS
 * - Primary URLs with ?sslmode=disable → never TLS
 * - DB_SSL / DATABASE_SSL = true → TLS
 */

function envUrlsPreferSslDisable() {
  const urls = [
    process.env.TENANT_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.GENERIC_URL,
  ]
    .filter(Boolean)
    .map((u) => String(u).toLowerCase());
  return urls.some(
    (u) => u.includes('sslmode=disable') || u.includes('ssl=false'),
  );
}

function envFlagIsFalse(name) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  return raw === 'false' || raw === '0' || raw === 'no' || raw === 'off';
}

function envFlagIsTrue(name) {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
}

function getPgSslOption() {
  if (envFlagIsFalse('DB_SSL') || envFlagIsFalse('DATABASE_SSL') || envUrlsPreferSslDisable()) {
    return false;
  }
  if (envFlagIsTrue('DB_SSL') || envFlagIsTrue('DATABASE_SSL')) {
    return { rejectUnauthorized: false };
  }
  return process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
}

function getPgClientConnectTimeoutMs() {
  const n = parseInt(process.env.PG_CLIENT_CONNECT_TIMEOUT_MS || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 30000;
}

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

function pgClientOptsFromDatabaseUrl(databaseUrl) {
  const { host, port, user, password, database } = parseDatabaseUrl(databaseUrl);
  const lower = String(databaseUrl || '').toLowerCase();
  let ssl = getPgSslOption();
  if (lower.includes('sslmode=disable') || lower.includes('ssl=false')) {
    ssl = false;
  } else if (
    host === 'alm_db' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === 'host.docker.internal'
  ) {
    ssl = false;
  }
  return {
    host,
    port,
    user,
    password,
    database,
    ssl,
    connectionTimeoutMillis: getPgClientConnectTimeoutMs(),
  };
}

module.exports = {
  getPgSslOption,
  getPgClientConnectTimeoutMs,
  parseDatabaseUrl,
  pgClientOptsFromDatabaseUrl,
};
