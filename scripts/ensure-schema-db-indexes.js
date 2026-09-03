#!/usr/bin/env node
/**
 * Ensure functional unique indexes used by tenant provisioning exist on schema_db
 * (and optionally on existing tenants that were created before the dump fix).
 *
 * Usage:
 *   node scripts/ensure-schema-db-indexes.js
 *   node scripts/ensure-schema-db-indexes.js --also=abcd_db
 *   node scripts/ensure-schema-db-indexes.js --also=abcd_db,other_db
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { getReferenceUrl, buildSchemaDbUrl } = require('../utils/tenantSchemaReference');
const { buildPoolConfig } = require('../utils/pgSsl');

const INDEX_SQL = [
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_tblacm_scope
ON public."tblACM" USING btree (user_id, access_level, org_id, branch_id, dept_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_spinddet_org_serial
ON public."tblSPIndDet" USING btree (org_id, serial_number)
WHERE ((serial_number IS NOT NULL) AND (btrim((serial_number)::text) <> ''::text))`,
];

const INDEX_NAMES = ['uq_tblacm_scope', 'uq_spinddet_org_serial'];

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
  const base =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.HOSPITALITY_DATABASE_URL;
  if (!base) {
    throw new Error('TENANT_DATABASE_URL or DATABASE_URL is required for --also=');
  }
  return buildSchemaDbUrl(base, dbName);
}

async function ensureIndexes(label, connectionString) {
  if (!connectionString) {
    throw new Error(`No connection string for ${label}`);
  }

  const client = new Client(buildPoolConfig(connectionString, { connectionTimeoutMillis: 20000 }));
  await client.connect();
  try {
    console.log(`\n[${label}] Applying unique indexes...`);
    for (const sql of INDEX_SQL) {
      await client.query(sql);
    }

    const { rows } = await client.query(
      `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = ANY($1::text[])
        ORDER BY indexname
      `,
      [INDEX_NAMES],
    );

    for (const name of INDEX_NAMES) {
      const found = rows.find((r) => r.indexname === name);
      console.log(found ? `  ✓ ${name}` : `  ✗ MISSING ${name}`);
    }
    return rows.length === INDEX_NAMES.length;
  } finally {
    await client.end();
  }
}

(async () => {
  const alsoDbs = parseAlsoArg(process.argv.slice(2));
  const referenceUrl = getReferenceUrl();
  if (!referenceUrl) {
    throw new Error(
      'TENANT_SCHEMA_REFERENCE_URL (or TENANT_DATABASE_URL/DATABASE_URL for schema_db) must be set',
    );
  }

  const dbLabel = referenceUrl.split('/').pop()?.split('?')[0] || 'schema_db';
  let ok = await ensureIndexes(dbLabel, referenceUrl);

  for (const name of alsoDbs) {
    const tenantOk = await ensureIndexes(name, tenantDbUrl(name));
    ok = ok && tenantOk;
  }

  if (!ok) {
    console.error('\nOne or more indexes are still missing.');
    process.exit(1);
  }
  console.log('\nDone.');
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
