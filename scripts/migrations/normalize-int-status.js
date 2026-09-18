#!/usr/bin/env node
/**
 * Normalize int_status on tables that already have the column.
 * Convention: 0 = inactive, 1 = active (vendors may also use 3=CRApproved, 4=Blocked).
 * tblApps keeps boolean (true=active / false=inactive).
 *
 * Does NOT add int_status to tables that lack it.
 *
 * Usage:
 *   node scripts/migrations/normalize-int-status.js [--dry-run] [db1 db2 ...]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { Client } = require('pg');

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

async function normalizeDb(dbName, { dryRun = false } = {}) {
  const client = new Client({ connectionString: dbUrl(dbName), ssl: false });
  await client.connect();
  const report = {
    db: dbName,
    tables: 0,
    alteredType: [],
    setDefault: [],
    normalizedValues: [],
    errors: [],
  };

  try {
    const cols = await client.query(`
      SELECT table_name, data_type, column_default, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'int_status'
      ORDER BY table_name
    `);
    report.tables = cols.rows.length;

    for (const col of cols.rows) {
      const table = col.table_name;
      const qTable = `public.${quoteIdent(table)}`;

      try {
        // --- value cleanup (only for non-boolean) ---
        if (col.data_type !== 'boolean') {
          // Map common text synonyms if column is somehow textual
          if (['character varying', 'character', 'text'].includes(col.data_type)) {
            const sqls = [
              `UPDATE ${qTable} SET int_status = '1' WHERE LOWER(TRIM(int_status::text)) IN ('active','a','true','t','yes','y')`,
              `UPDATE ${qTable} SET int_status = '0' WHERE LOWER(TRIM(int_status::text)) IN ('inactive','i','false','f','no','n')`,
            ];
            for (const sql of sqls) {
              if (dryRun) {
                report.normalizedValues.push({ table, sql, dryRun: true });
              } else {
                const res = await client.query(sql);
                if (res.rowCount) {
                  report.normalizedValues.push({ table, rowCount: res.rowCount, sql });
                }
              }
            }
          }

          // Cast numeric / text → integer column type
          if (col.data_type !== 'integer' && col.data_type !== 'smallint' && col.data_type !== 'bigint') {
            const alter = `ALTER TABLE ${qTable} ALTER COLUMN int_status TYPE integer USING (
              CASE
                WHEN LOWER(TRIM(int_status::text)) IN ('active','a','true','t','yes','y','1') THEN 1
                WHEN LOWER(TRIM(int_status::text)) IN ('inactive','i','false','f','no','n','0') THEN 0
                WHEN LOWER(TRIM(int_status::text)) IN ('crapproved','3') THEN 3
                WHEN LOWER(TRIM(int_status::text)) IN ('blocked','4') THEN 4
                WHEN int_status::text ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ROUND(int_status::numeric)::integer
                ELSE 0
              END
            )`;
            if (dryRun) {
              report.alteredType.push({ table, from: col.data_type, to: 'integer', dryRun: true });
            } else {
              await client.query(alter);
              report.alteredType.push({ table, from: col.data_type, to: 'integer' });
            }
          }

          // Ensure DEFAULT 1
          const needsDefault =
            !col.column_default || !/\b1\b/.test(String(col.column_default));
          // After type change, re-check / always set default 1 for integer status
          if (needsDefault || report.alteredType.some((a) => a.table === table)) {
            const defSql = `ALTER TABLE ${qTable} ALTER COLUMN int_status SET DEFAULT 1`;
            if (dryRun) {
              report.setDefault.push({ table, dryRun: true });
            } else {
              await client.query(defSql);
              report.setDefault.push({ table });
            }
          }
        } else if (table === 'tblApps') {
          // boolean apps: true = active
          if (!col.column_default || !/true/i.test(String(col.column_default))) {
            const defSql = `ALTER TABLE ${qTable} ALTER COLUMN int_status SET DEFAULT true`;
            if (dryRun) {
              report.setDefault.push({ table, default: 'true', dryRun: true });
            } else {
              await client.query(defSql);
              report.setDefault.push({ table, default: 'true' });
            }
          }
        }
      } catch (err) {
        report.errors.push({ table, message: err.message });
      }
    }
  } finally {
    await client.end();
  }

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const explicit = args.filter((a) => a !== '--dry-run');
  const databases = explicit.length ? explicit : await listEamDatabases();

  console.log(
    `[normalize-int-status] ${dryRun ? 'DRY-RUN ' : ''}databases (${databases.length}): ${databases.join(', ')}`,
  );
  console.log('Convention: 0=inactive, 1=active (vendors: 3=CRApproved, 4=Blocked). Never adds missing columns.');

  let typeChanges = 0;
  let defaults = 0;
  let errors = 0;

  for (const db of databases) {
    try {
      const report = await normalizeDb(db, { dryRun });
      typeChanges += report.alteredType.length;
      defaults += report.setDefault.length;
      errors += report.errors.length;
      console.log(
        `  ${db}: tables_with_int_status=${report.tables} type_fixes=${report.alteredType.length} defaults=${report.setDefault.length} value_fixes=${report.normalizedValues.length} errors=${report.errors.length}`,
      );
      if (report.alteredType.length) {
        console.log(
          `    types: ${report.alteredType.map((a) => `${a.table}(${a.from}->${a.to})`).join(', ')}`,
        );
      }
      if (report.errors.length) {
        for (const e of report.errors.slice(0, 5)) {
          console.log(`    ERR ${e.table}: ${e.message}`);
        }
      }
    } catch (err) {
      errors += 1;
      console.error(`  ${db}: FAILED ${err.message}`);
    }
  }

  console.log(
    `[normalize-int-status] done. type_fixes=${typeChanges} defaults_set=${defaults} errors=${errors}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
