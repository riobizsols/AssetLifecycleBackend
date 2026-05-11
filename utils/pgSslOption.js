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

module.exports = { getPgSslOption, getPgClientConnectTimeoutMs };
