#!/usr/bin/env node
/**
 * Render PgBouncer config from .env.production (or env).
 * Output: config/pgbouncer/generated/pgbouncer.ini + userlist.txt
 *
 * Usage (from AssetLifecycleBackend):
 *   node scripts/db/render-pgbouncer-config.js
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env.production') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { parseDatabaseUrl } = require('../../utils/pgSslOption');

const OUT_DIR = path.join(__dirname, '../../config/pgbouncer/generated');

function resolveCredentials() {
  const directUrl =
    process.env.POSTGRES_DIRECT_URL ||
    process.env.DATABASE_URL ||
    process.env.TENANT_DATABASE_URL;

  if (!directUrl) {
    throw new Error('Set POSTGRES_DIRECT_URL or DATABASE_URL in .env.production');
  }

  const parsed = parseDatabaseUrl(directUrl);
  let host = process.env.POSTGRES_DIRECT_HOST || parsed.host;
  let port = parseInt(process.env.POSTGRES_DIRECT_PORT || String(parsed.port || 5432), 10);

  if (host === (process.env.PGBOUNCER_HOST || 'alm_pgbouncer')) {
    host = 'alm_db';
    port = 5432;
  }

  return {
    user: parsed.user,
    password: parsed.password,
    postgresHost: host,
    postgresPort: port,
  };
}

function main() {
  const {
    user,
    password,
    postgresHost,
    postgresPort,
  } = resolveCredentials();

  const maxClientConn = process.env.PGBOUNCER_MAX_CLIENT_CONN || '500';
  const defaultPoolSize = process.env.PGBOUNCER_DEFAULT_POOL_SIZE || '25';
  const minPoolSize = process.env.PGBOUNCER_MIN_POOL_SIZE || '2';
  const reservePoolSize = process.env.PGBOUNCER_RESERVE_POOL_SIZE || '5';
  const poolMode = process.env.PGBOUNCER_POOL_MODE || 'transaction';

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const ini = `[databases]
; Pass-through: client db name maps to same db on Postgres (supports tenant DBs)
* = host=${postgresHost} port=${postgresPort}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = plain
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = ${poolMode}
max_client_conn = ${maxClientConn}
default_pool_size = ${defaultPoolSize}
min_pool_size = ${minPoolSize}
reserve_pool_size = ${reservePoolSize}
server_reset_query = DISCARD ALL
ignore_startup_parameters = extra_float_digits,search_path,application_name
max_prepared_statements = 0
admin_users = ${user}
stats_users = ${user}
log_connections = 0
log_disconnections = 0
`;

  const userlist = `"${user}" "${password.replace(/"/g, '\\"')}"\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'pgbouncer.ini'), ini, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'userlist.txt'), userlist, 'utf8');
  fs.chmodSync(path.join(OUT_DIR, 'userlist.txt'), 0o600);

  console.log(`✅ PgBouncer config written to ${OUT_DIR}`);
  console.log(`   Postgres backend: ${postgresHost}:${postgresPort}`);
  console.log(`   Pool mode: ${poolMode}, default_pool_size: ${defaultPoolSize}`);
}

main();
