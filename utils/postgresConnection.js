const { parseDatabaseUrl, pgClientOptsFromDatabaseUrl } = require('./pgSslOption');

function isPgBouncerEnabled() {
  const raw = String(process.env.PGBOUNCER_ENABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function getPgBouncerHost() {
  return process.env.PGBOUNCER_HOST || 'alm_pgbouncer';
}

function getPgBouncerPort() {
  const parsed = parseInt(process.env.PGBOUNCER_PORT || '6432', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 6432;
}

function getPostgresDirectHost() {
  return process.env.POSTGRES_DIRECT_HOST || 'alm_db';
}

function getPostgresDirectPort() {
  const parsed = parseInt(process.env.POSTGRES_DIRECT_PORT || '5432', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5432;
}

function rewriteDatabaseUrlHostPort(databaseUrl, host, port) {
  const parsed = parseDatabaseUrl(databaseUrl);
  const user = encodeURIComponent(parsed.user);
  const password = encodeURIComponent(parsed.password);
  const dbName = parsed.database;
  const sslSuffix = String(databaseUrl).includes('sslmode=disable') ? '?sslmode=disable' : '';
  return `postgresql://${user}:${password}@${host}:${port}/${dbName}${sslSuffix}`;
}

function urlPointsAtPgBouncer(databaseUrl) {
  if (!databaseUrl) return false;
  try {
    const parsed = parseDatabaseUrl(databaseUrl);
    return parsed.host === getPgBouncerHost() || parsed.port === getPgBouncerPort();
  } catch (_) {
    return String(databaseUrl).includes(getPgBouncerHost());
  }
}

/**
 * Direct Postgres URL for DDL/admin (CREATE DATABASE, ALTER DATABASE, pg_database).
 * Never route these through PgBouncer transaction pooling.
 */
function getPostgresDirectUrl(databaseUrl) {
  if (process.env.POSTGRES_DIRECT_URL) {
    return process.env.POSTGRES_DIRECT_URL;
  }

  const sourceUrl = databaseUrl || process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!sourceUrl) {
    throw new Error('No database URL available for direct Postgres connection');
  }

  if (urlPointsAtPgBouncer(sourceUrl) || isPgBouncerEnabled()) {
    return rewriteDatabaseUrlHostPort(
      sourceUrl,
      getPostgresDirectHost(),
      getPostgresDirectPort(),
    );
  }

  return sourceUrl;
}

/**
 * Host/port stored in tenants table and used by runtime tenant pools when PgBouncer is enabled.
 */
function getAppDatabaseEndpoint() {
  if (isPgBouncerEnabled()) {
    return { host: getPgBouncerHost(), port: getPgBouncerPort() };
  }
  return { host: getPostgresDirectHost(), port: getPostgresDirectPort() };
}

function getPostgresDirectClientOpts(databaseUrl, databaseName) {
  const directUrl = getPostgresDirectUrl(databaseUrl);
  const opts = pgClientOptsFromDatabaseUrl(directUrl);
  if (databaseName) {
    opts.database = databaseName;
  }
  return opts;
}

module.exports = {
  isPgBouncerEnabled,
  getPgBouncerHost,
  getPgBouncerPort,
  getPostgresDirectHost,
  getPostgresDirectPort,
  rewriteDatabaseUrlHostPort,
  getPostgresDirectUrl,
  getAppDatabaseEndpoint,
  getPostgresDirectClientOpts,
  urlPointsAtPgBouncer,
};
