#!/usr/bin/env node
/**
 * Ensure every public base table has:
 *   org_id    VARCHAR(50)  — mandatory for multi-tenant scope (nullable at DB layer so existing rows stay valid)
 *   branch_id VARCHAR(50)  — mandatory for branch scope
 *   dept_id   VARCHAR(50)  — optional department scope
 *
 * Usage:
 *   node scripts/migrations/ensure-org-branch-dept-columns.js [--dry-run] [db1 db2 ...]
 *
 * With no DB args, runs against all EAM databases (public."tblAssets" present),
 * plus schema_db / hospitality / assetLifecycle registry templates.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { Client } = require('pg');

const COLUMNS = [
  { name: 'org_id', ddl: 'character varying(50)' },
  { name: 'branch_id', ddl: 'character varying(50)' },
  { name: 'dept_id', ddl: 'character varying(50)' },
];

const SKIP_TABLES = new Set([
  'spatial_ref_sys',
  'geography_columns',
  'geometry_columns',
  'raster_columns',
  'raster_overviews',
]);

const ALWAYS_INCLUDE = ['schema_db', 'hospitality', 'assetLifecycle', 'assetlifecycle'];

function dbUrl(name) {
  const base =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.GENERIC_URL;
  if (!base) throw new Error('No TENANT_DATABASE_URL / DATABASE_URL / GENERIC_URL');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function listEamDatabases() {
  const admin = new Client({ connectionString: dbUrl('postgres'), ssl: false });
  await admin.connect();
  try {
    const { rows } = await admin.query(`
      SELECT datname
      FROM pg_database
      WHERE datistemplate = false
        AND datname NOT IN ('postgres')
      ORDER BY 1
    `);

    const eam = new Set(ALWAYS_INCLUDE);
    for (const { datname } of rows) {
      if (/_attdb$|^Attendence/i.test(datname)) continue;
      const client = new Client({ connectionString: dbUrl(datname), ssl: false });
      try {
        await client.connect();
        const check = await client.query(`SELECT to_regclass('public."tblAssets"') AS t`);
        if (check.rows[0]?.t) eam.add(datname);
      } catch (_) {
        /* skip unreachable */
      } finally {
        try {
          await client.end();
        } catch (_) {
          /* ignore */
        }
      }
    }
    return [...eam].sort();
  } finally {
    await admin.end();
  }
}

async function ensureColumnsOnDatabase(dbName, { dryRun = false } = {}) {
  const client = new Client({ connectionString: dbUrl(dbName), ssl: false });
  await client.connect();
  const summary = {
    db: dbName,
    tables: 0,
    added: [],
    skipped: [],
    errors: [],
  };

  try {
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    for (const { table_name: tableName } of tablesRes.rows) {
      if (SKIP_TABLES.has(tableName)) continue;
      summary.tables += 1;

      const colsRes = await client.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = ANY($2::text[])
        `,
        [tableName, COLUMNS.map((c) => c.name)],
      );
      const existing = new Set(colsRes.rows.map((r) => r.column_name));

      for (const col of COLUMNS) {
        if (existing.has(col.name)) continue;
        const sql = `ALTER TABLE public.${quoteIdent(tableName)} ADD COLUMN IF NOT EXISTS ${quoteIdent(col.name)} ${col.ddl}`;
        if (dryRun) {
          summary.added.push({ table: tableName, column: col.name, dryRun: true });
          continue;
        }
        try {
          await client.query(sql);
          summary.added.push({ table: tableName, column: col.name });
        } catch (err) {
          summary.errors.push({
            table: tableName,
            column: col.name,
            message: err.message,
          });
        }
      }
    }
  } finally {
    await client.end();
  }

  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const explicitDbs = args.filter((a) => a !== '--dry-run');

  const databases = explicitDbs.length ? explicitDbs : await listEamDatabases();
  console.log(
    `[ensure-org-branch-dept] ${dryRun ? 'DRY-RUN ' : ''}databases (${databases.length}): ${databases.join(', ')}`,
  );

  const reports = [];
  for (const db of databases) {
    try {
      const report = await ensureColumnsOnDatabase(db, { dryRun });
      reports.push(report);
      console.log(
        `  ${db}: tables=${report.tables} added=${report.added.length} errors=${report.errors.length}`,
      );
      if (report.errors.length) {
        for (const e of report.errors.slice(0, 10)) {
          console.log(`    ERR ${e.table}.${e.column}: ${e.message}`);
        }
      }
    } catch (err) {
      console.error(`  ${db}: FAILED ${err.message}`);
      reports.push({ db, fatal: err.message });
    }
  }

  const totalAdded = reports.reduce((n, r) => n + (r.added?.length || 0), 0);
  const totalErrors = reports.reduce((n, r) => n + (r.errors?.length || 0), 0);
  console.log(`[ensure-org-branch-dept] done. columns_added=${totalAdded} errors=${totalErrors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
