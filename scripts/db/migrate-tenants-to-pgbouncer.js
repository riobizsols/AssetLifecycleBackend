#!/usr/bin/env node
/**
 * Point tenants.db_host/db_port at PgBouncer (runtime app traffic).
 * Admin scripts still use POSTGRES_DIRECT_URL.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.production') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Pool } = require('pg');
const { buildPoolConfig } = require('../../utils/pgSsl');
const {
  getPgBouncerHost,
  getPgBouncerPort,
  getPostgresDirectHost,
  getPostgresDirectUrl,
} = require('../../utils/postgresConnection');

async function main() {
  const registryUrl = getPostgresDirectUrl(process.env.TENANT_DATABASE_URL);
  const pool = new Pool(buildPoolConfig(registryUrl, { max: 2 }));

  const bouncerHost = getPgBouncerHost();
  const bouncerPort = getPgBouncerPort();
  const directHost = getPostgresDirectHost();

  const result = await pool.query(
    `
      UPDATE tenants
      SET db_host = $1,
          db_port = $2
      WHERE db_host = $3
         OR db_host IN ('localhost', '127.0.0.1')
      RETURNING org_id, db_name, db_host, db_port
    `,
    [bouncerHost, bouncerPort, directHost],
  );

  console.log(`✅ Updated ${result.rowCount} tenant row(s) → ${bouncerHost}:${bouncerPort}`);
  for (const row of result.rows) {
    console.log(`   ${row.org_id} / ${row.db_name}`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
