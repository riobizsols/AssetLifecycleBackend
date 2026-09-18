#!/usr/bin/env node
/**
 * Create tblAuditType + tblAuditATMapping on all EAM databases (incl. schema_db).
 *
 * Usage:
 *   node scripts/migrations/create-audit-tables.js [--dry-run] [db1 db2 ...]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { Client } = require('pg');
const { ensureAuditTablesSchema } = require('../../utils/ensureAuditTablesSchema');

const ALWAYS_INCLUDE = ['schema_db', 'hospitality', 'assetLifecycle', 'assetlifecycle'];

function dbUrl(name) {
  const base =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.GENERIC_URL;
  if (!base) throw new Error('No database URL');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

async function listEamDatabases() {
  const admin = new Client({ connectionString: dbUrl('postgres'), ssl: false });
  await admin.connect();
  try {
    const { rows } = await admin.query(`
      SELECT datname FROM pg_database
      WHERE datistemplate = false AND datname NOT IN ('postgres')
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
        /* skip */
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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const explicit = args.filter((a) => a !== '--dry-run');
  const databases = explicit.length ? explicit : await listEamDatabases();

  console.log(
    `[create-audit-tables] ${dryRun ? 'DRY-RUN ' : ''}dbs (${databases.length}): ${databases.join(', ')}`,
  );

  let ok = 0;
  let failed = 0;

  for (const db of databases) {
    if (dryRun) {
      console.log(`  ${db}: would ensure tblAuditType + tblAuditATMapping`);
      ok += 1;
      continue;
    }
    const client = new Client({ connectionString: dbUrl(db), ssl: false });
    try {
      await client.connect();
      await ensureAuditTablesSchema(client);
      const check = await client.query(`
        SELECT
          to_regclass('public."tblAuditType"') AS audit_type,
          to_regclass('public."tblAuditATMapping"') AS audit_map
      `);
      console.log(
        `  ${db}: ok type=${Boolean(check.rows[0].audit_type)} map=${Boolean(check.rows[0].audit_map)}`,
      );
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`  ${db}: FAILED ${err.message}`);
    } finally {
      try {
        await client.end();
      } catch (_) {
        /* ignore */
      }
    }
  }

  console.log(`[create-audit-tables] done. ok=${ok} failed=${failed}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
