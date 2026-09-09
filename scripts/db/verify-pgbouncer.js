#!/usr/bin/env node
/**
 * Verify PgBouncer can reach Postgres and serve app databases.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.production') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Pool } = require('pg');
const { buildPoolConfig } = require('../../utils/pgSsl');
const {
  getPgBouncerHost,
  getPgBouncerPort,
  getPostgresDirectUrl,
} = require('../../utils/postgresConnection');

async function check(label, connectionString) {
  const pool = new Pool(buildPoolConfig(connectionString, { max: 1 }));
  try {
    const res = await pool.query('SELECT current_database() AS db, NOW() AS ts');
    console.log(`✅ ${label}: db=${res.rows[0].db} ts=${res.rows[0].ts}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  const bouncerHost = getPgBouncerHost();
  const bouncerPort = getPgBouncerPort();

  const appUrl = process.env.DATABASE_URL;
  if (!appUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  console.log(`Checking PgBouncer at ${bouncerHost}:${bouncerPort}...`);
  await check('PgBouncer (DATABASE_URL)', appUrl);

  const directUrl = getPostgresDirectUrl(appUrl);
  await check('Direct Postgres (admin)', directUrl);

  if (process.env.TENANT_DATABASE_URL) {
    await check('PgBouncer tenant registry', process.env.TENANT_DATABASE_URL);
  }
}

main().catch((err) => {
  console.error('❌ PgBouncer verification failed:', err.message);
  process.exit(1);
});
