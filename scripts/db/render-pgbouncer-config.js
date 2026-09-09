#!/usr/bin/env node
/**
 * Render PgBouncer config from .env.production (or env).
 * Output: config/pgbouncer/generated/pgbouncer.ini + userlist.txt
 *
 * No npm deps — safe to run with `docker run node:20-bookworm-slim` on rio-server.
 *
 * Usage (from AssetLifecycleBackend):
 *   node scripts/db/render-pgbouncer-config.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'config/pgbouncer/generated');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('Database URL is required');
  }
  const cleaned = databaseUrl.trim();
  try {
    const url = new URL(cleaned);
    return {
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
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
    };
  }
}

loadEnvFile(path.join(ROOT, '.env.production'));
loadEnvFile(path.join(ROOT, '.env'));

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

  const userlist = `"${user}" "${String(password || '').replace(/"/g, '\\"')}"\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'pgbouncer.ini'), ini, 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'userlist.txt'), userlist, 'utf8');
  fs.chmodSync(path.join(OUT_DIR, 'userlist.txt'), 0o600);

  console.log(`PgBouncer config written to ${OUT_DIR}`);
  console.log(`   Postgres backend: ${postgresHost}:${postgresPort}`);
  console.log(`   Pool mode: ${poolMode}, default_pool_size: ${defaultPoolSize}`);
}

main();
