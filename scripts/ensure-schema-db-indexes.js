#!/usr/bin/env node
/**
 * Ensure critical unique indexes exist on schema_db (tenant template) and optionally
 * backfill an existing tenant DB (e.g. abcd_db).
 *
 * Usage:
 *   node scripts/ensure-schema-db-indexes.js
 *   node scripts/ensure-schema-db-indexes.js --also=abcd_db
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const ALSO = process.argv.find((a) => a.startsWith('--also='))?.split('=')[1];
const TARGETS = ['schema_db', ...(ALSO ? ALSO.split(',').map((s) => s.trim()).filter(Boolean) : [])];

const INDEX_SQL = [
  {
    name: 'uq_tblacm_scope',
    table: 'tblACM',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tblacm_scope
      ON public."tblACM" USING btree (user_id, access_level, org_id, branch_id, dept_id)
    `,
  },
  {
    name: 'uq_spinddet_org_serial',
    table: 'tblSPIndDet',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS uq_spinddet_org_serial
      ON public."tblSPIndDet" USING btree (org_id, serial_number)
      WHERE ((serial_number IS NOT NULL) AND (btrim((serial_number)::text) <> ''::text))
    `,
  },
];

function dbUrl(name) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?|$)/, `/${name}$2`);
}

async function tableExists(pool, table) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table],
  );
  return r.rows.length > 0;
}

async function indexExists(pool, indexName) {
  const r = await pool.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=$1`,
    [indexName],
  );
  return r.rows.length > 0;
}

async function ensureDb(dbName) {
  const pool = new Pool({
    connectionString: dbUrl(dbName),
    ssl: false,
    connectionTimeoutMillis: 20000,
  });
  console.log(`\n── ${dbName} ──`);
  try {
    for (const idx of INDEX_SQL) {
      if (!(await tableExists(pool, idx.table))) {
        console.log(`  skip ${idx.name}: table ${idx.table} missing`);
        continue;
      }
      if (await indexExists(pool, idx.name)) {
        console.log(`  ok   ${idx.name} (already present)`);
        continue;
      }
      await pool.query(idx.sql);
      console.log(`  +    ${idx.name} created`);
    }
  } finally {
    await pool.end();
  }
}

(async () => {
  for (const db of TARGETS) await ensureDb(db);
  console.log('\nDone.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
