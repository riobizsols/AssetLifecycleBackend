#!/usr/bin/env node
/**
 * Migration: Create Consumables tables (tblConsumables, tblConsumInven, tblConsumeUsage)
 * on schema_db (template for new tenants) and optionally on existing tenant DBs.
 *
 * Run:
 *   node migrations/create-consumables-tables.js                 # schema_db only
 *   node migrations/create-consumables-tables.js --also=ngp_db   # schema_db + ngp_db
 *   node migrations/create-consumables-tables.js --also=ngp_db,other_db
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { getReferenceUrl, buildSchemaDbUrl } = require('../utils/tenantSchemaReference');
const { buildPoolConfig } = require('../utils/pgSsl');
const {
  CONSUMABLES_TABLES,
  ensureConsumablesSchema,
} = require('../utils/ensureConsumablesSchema');

function parseAlsoArg(argv) {
  const flag = argv.find((a) => a.startsWith('--also='));
  if (!flag) return [];
  return flag
    .slice('--also='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function tenantDbUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) {
    throw new Error('TENANT_DATABASE_URL or DATABASE_URL is required for --also=');
  }
  return buildSchemaDbUrl(base, dbName);
}

async function migrate(label, connectionString) {
  const client = new Client(buildPoolConfig(connectionString, { connectionTimeoutMillis: 20000 }));
  await client.connect();
  try {
    console.log(`\n[${label}] Ensuring consumables tables...`);
    await ensureConsumablesSchema(client);

    const { rows } = await client.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])
      `,
      [CONSUMABLES_TABLES],
    );
    const found = new Set(rows.map((r) => r.table_name));
    for (const table of CONSUMABLES_TABLES) {
      console.log(found.has(table) ? `  ✓ ${table}` : `  ✗ MISSING ${table}`);
    }
    return found.size === CONSUMABLES_TABLES.length;
  } finally {
    await client.end();
  }
}

(async () => {
  const referenceUrl = getReferenceUrl();
  if (!referenceUrl) {
    throw new Error(
      'TENANT_SCHEMA_REFERENCE_URL (or TENANT_DATABASE_URL/DATABASE_URL for schema_db) must be set',
    );
  }

  const refLabel = referenceUrl.split('/').pop()?.split('?')[0] || 'schema_db';
  let ok = await migrate(refLabel, referenceUrl);

  for (const name of parseAlsoArg(process.argv.slice(2))) {
    ok = (await migrate(name, tenantDbUrl(name))) && ok;
  }

  if (!ok) {
    console.error('\nOne or more consumables tables are still missing.');
    process.exit(1);
  }
  console.log('\nDone.');
})().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
