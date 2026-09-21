#!/usr/bin/env node
/**
 * Enforce EAM table ID naming conventions across all tenant DBs.
 *
 * - Preferred: tblAssetMaintSch.ams_id → AMS001
 * - Accepts tenant serials that still match PREFIX+digits (e.g. BNA000001)
 * - Uppercases known lowercase prefixes (ams001 → AMS001)
 * - Syncs tblIDSequences prefixes
 * - Adds CHECK constraints + INSERT/UPDATE trigger validation
 * - Does NOT invent ID columns on tables that lack them
 *
 * Usage:
 *   node scripts/migrations/enforce-table-id-conventions.js [--dry-run] [db1 db2 ...]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { Client } = require('pg');
const {
  TABLE_ID_CONVENTIONS,
  GENERAL_ID_SQL,
} = require('../../constants/tableIdConventions');
const { DEFAULT_ID_SEQUENCES } = require('../../constants/setupDefaults');

const ALWAYS_INCLUDE = ['schema_db', 'hospitality', 'assetLifecycle', 'assetlifecycle'];

function dbUrl(name) {
  const base =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.GENERIC_URL;
  if (!base) throw new Error('No database URL');
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

async function tableHasColumn(client, table, column) {
  const { rows } = await client.query(
    `
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 AND column_name=$2
    `,
    [table, column]
  );
  return rows.length > 0;
}

async function tableExists(client, table) {
  const { rows } = await client.query(
    `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=$1
    ) AS e
    `,
    [table]
  );
  return rows[0].e;
}

/**
 * Uppercase IDs whose prefix matches a known lowercase form of the canonical prefix.
 * Temporarily drops inbound FKs so PK values can be rewritten safely, then recreates them.
 */
async function uppercasePrefixIds(client, rule, { dryRun }) {
  if (!rule.prefix || rule.enforceFormat === false) return { updated: 0 };

  const prefix = rule.prefix;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const anyCase = `^${escaped}[0-9]{3,}$`;
  const exact = `^${escaped}[0-9]{3,}$`;

  const { rows } = await client.query(
    `
    SELECT "${rule.column}" AS id
    FROM "${rule.table}"
    WHERE "${rule.column}" ~* $1
      AND "${rule.column}" !~ $2
    `,
    [anyCase, exact]
  );
  if (!rows.length) return { updated: 0, samples: [] };

  if (dryRun) {
    return { updated: rows.length, samples: rows.slice(0, 5).map((r) => r.id), dryRun: true };
  }

  // Discover inbound FKs to this PK
  const fks = await client.query(
    `
    SELECT
      tc.constraint_name,
      tc.table_name AS child_table,
      kcu.column_name AS child_column,
      rc.update_rule,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = $1
      AND ccu.column_name = $2
    `,
    [rule.table, rule.column]
  );

  await client.query('BEGIN');
  try {
    for (const fk of fks.rows) {
      await client.query(
        `ALTER TABLE ${quoteIdent(fk.child_table)} DROP CONSTRAINT IF EXISTS ${quoteIdent(fk.constraint_name)}`
      );
    }

    // Update any same-named / alias columns in other tables
    const childCols = await client.query(
      `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND (
          column_name = $1
          OR ($1 = 'ams_id' AND column_name = 'assetmaintsch_id')
        )
        AND NOT (table_name = $2 AND column_name = $1)
      `,
      [rule.column, rule.table]
    );

    for (const { table_name, column_name } of childCols.rows) {
      await client.query(
        `
        UPDATE "${table_name}"
        SET "${column_name}" = regexp_replace("${column_name}", $1, $2, 'i')
        WHERE "${column_name}" ~* $3
          AND "${column_name}" !~ $4
        `,
        [`^(${escaped})`, prefix, anyCase, exact]
      );
    }

    const updated = await client.query(
      `
      UPDATE "${rule.table}"
      SET "${rule.column}" = regexp_replace("${rule.column}", $1, $2, 'i')
      WHERE "${rule.column}" ~* $3
        AND "${rule.column}" !~ $4
      `,
      [`^(${escaped})`, prefix, anyCase, exact]
    );

    // Recreate FKs
    for (const fk of fks.rows) {
      const onUpdate = fk.update_rule === 'CASCADE' ? 'ON UPDATE CASCADE' : 'ON UPDATE NO ACTION';
      const onDelete = fk.delete_rule === 'CASCADE' ? 'ON DELETE CASCADE' : 'ON DELETE NO ACTION';
      await client.query(`
        ALTER TABLE ${quoteIdent(fk.child_table)}
        ADD CONSTRAINT ${quoteIdent(fk.constraint_name)}
        FOREIGN KEY (${quoteIdent(fk.child_column)})
        REFERENCES ${quoteIdent(rule.table)} (${quoteIdent(rule.column)})
        ${onUpdate} ${onDelete}
      `);
    }

    await client.query('COMMIT');
    return {
      updated: updated.rowCount || 0,
      samples: rows.slice(0, 5).map((r) => r.id),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function ensureCheckConstraint(client, rule, { dryRun }) {
  if (rule.enforceFormat === false || !rule.prefix) return { skipped: true };
  if (!(await tableExists(client, rule.table))) return { skipped: true };
  if (!(await tableHasColumn(client, rule.table, rule.column))) return { skipped: true };

  const cname = `chk_${rule.table}_${rule.column}_idfmt`.slice(0, 63);
  const drop = `ALTER TABLE ${quoteIdent(rule.table)} DROP CONSTRAINT IF EXISTS ${quoteIdent(cname)}`;
  const add = `
    ALTER TABLE ${quoteIdent(rule.table)}
    ADD CONSTRAINT ${quoteIdent(cname)}
    CHECK (
      "${rule.column}" IS NULL
      OR "${rule.column}"::text ~ '${GENERAL_ID_SQL}'
    )
  `;

  // Skip if existing invalid rows would block constraint
  const bad = await client.query(
    `
    SELECT COUNT(*)::int AS c FROM "${rule.table}"
    WHERE "${rule.column}" IS NOT NULL AND "${rule.column}"::text !~ $1
    `,
    [GENERAL_ID_SQL]
  );
  if (bad.rows[0].c > 0) {
    return { skipped: true, reason: `has ${bad.rows[0].c} invalid ids` };
  }

  if (dryRun) return { added: true, dryRun: true, constraint: cname };
  await client.query(drop);
  await client.query(add);
  return { added: true, constraint: cname };
}

async function ensureTrigger(client, { dryRun, withTriggers = false }) {
  // CHECK constraints already block bad inserts/updates from any client (app, bulk, psql).
  // Optional triggers add a clearer error message but are expensive across many tables.
  if (!withTriggers) {
    return { function: false, triggers: 0, skipped: true };
  }

  const fnSql = `
    CREATE OR REPLACE FUNCTION public.enforce_eam_id_format()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      col text := TG_ARGV[0];
      val text;
    BEGIN
      EXECUTE format('SELECT ($1).%I::text', col) INTO val USING NEW;
      IF val IS NULL OR btrim(val) = '' THEN
        RETURN NEW;
      END IF;
      IF val !~ '${GENERAL_ID_SQL}' THEN
        RAISE EXCEPTION 'Invalid % value "%". Expected PREFIX001 style (e.g. AMS001).', col, val;
      END IF;
      RETURN NEW;
    END;
    $$;
  `;

  if (dryRun) return { function: true, dryRun: true };
  await client.query(fnSql);

  const attached = [];
  for (const rule of TABLE_ID_CONVENTIONS) {
    if (rule.enforceFormat === false || !rule.prefix) continue;
    if (!(await tableExists(client, rule.table))) continue;
    if (!(await tableHasColumn(client, rule.table, rule.column))) continue;

    const tname = `trg_idfmt_${rule.table}_${rule.column}`.slice(0, 63);
    await client.query(`DROP TRIGGER IF EXISTS ${quoteIdent(tname)} ON ${quoteIdent(rule.table)}`);
    await client.query(`
      CREATE TRIGGER ${quoteIdent(tname)}
      BEFORE INSERT OR UPDATE OF ${quoteIdent(rule.column)}
      ON ${quoteIdent(rule.table)}
      FOR EACH ROW
      EXECUTE PROCEDURE public.enforce_eam_id_format('${rule.column}')
    `);
    attached.push(`${rule.table}.${rule.column}`);
  }
  return { function: true, triggers: attached.length };
}

async function syncSequences(client, { dryRun }) {
  const entries = [
    ...DEFAULT_ID_SEQUENCES,
    { tableKey: 'ams', prefix: 'AMS', lastNumber: 0 },
    { tableKey: 'asset_maint_sch', prefix: 'AMS', lastNumber: 0 },
  ];
  // dedupe by tableKey preferring later? keep first unique
  const seen = new Set();
  const uniq = [];
  for (const e of entries) {
    if (seen.has(e.tableKey)) continue;
    seen.add(e.tableKey);
    uniq.push(e);
  }

  if (dryRun) return { synced: uniq.length, dryRun: true };

  // Ensure table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS "tblIDSequences" (
      table_key character varying(100) PRIMARY KEY,
      prefix character varying(50),
      last_number integer DEFAULT 0
    )
  `);

  for (const e of uniq) {
    await client.query(
      `
      INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
      VALUES ($1, $2, $3)
      ON CONFLICT (table_key) DO UPDATE
      SET prefix = EXCLUDED.prefix
      `,
      [e.tableKey, e.prefix, e.lastNumber ?? 0]
    );
  }

  // Force AMS uppercase if legacy lowercase stored
  await client.query(`
    UPDATE "tblIDSequences"
    SET prefix = 'AMS'
    WHERE table_key IN ('ams', 'asset_maint_sch')
      AND (prefix IS NULL OR lower(prefix) = 'ams')
  `);

  return { synced: uniq.length };
}

async function processDb(dbName, { dryRun, withTriggers = false }) {
  console.log(`    connect ${dbName}…`);
  const client = new Client({
    connectionString: dbUrl(dbName),
    ssl: false,
    statement_timeout: 120000,
  });
  await client.connect();
  console.log(`    connected ${dbName}`);
  const report = {
    db: dbName,
    uppercased: [],
    constraints: [],
    sequences: null,
    triggers: null,
    errors: [],
  };

  try {
    console.log(`    sync sequences…`);
    report.sequences = await syncSequences(client, { dryRun });
    console.log(`    sequences done`);

    for (const rule of TABLE_ID_CONVENTIONS) {
      try {
        if (!(await tableExists(client, rule.table))) continue;
        if (!(await tableHasColumn(client, rule.table, rule.column))) continue;

        // Quick skip uppercase if no mismatched-case rows
        if (rule.prefix && rule.enforceFormat !== false) {
          const escaped = rule.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const need = await client.query(
            `
            SELECT 1 FROM "${rule.table}"
            WHERE "${rule.column}" ~* $1 AND "${rule.column}" !~ $2
            LIMIT 1
            `,
            [`^${escaped}[0-9]{3,}$`, `^${escaped}[0-9]{3,}$`]
          );
          if (need.rows.length) {
            console.log(`    uppercase ${rule.table}.${rule.column}…`);
            const up = await uppercasePrefixIds(client, rule, { dryRun });
            if (up.updated) {
              report.uppercased.push({
                table: rule.table,
                column: rule.column,
                updated: up.updated,
                samples: up.samples,
              });
            }
          }
        }

        const chk = await ensureCheckConstraint(client, rule, { dryRun });
        if (chk.added) report.constraints.push({ table: rule.table, column: rule.column, ...chk });
        else if (chk.reason) {
          report.constraints.push({
            table: rule.table,
            column: rule.column,
            skipped: true,
            reason: chk.reason,
          });
        }
      } catch (err) {
        report.errors.push({ table: rule.table, column: rule.column, message: err.message });
        console.log(`    ERR ${rule.table}.${rule.column}: ${err.message}`);
      }
    }

    console.log(`    triggers…`);
    report.triggers = await ensureTrigger(client, { dryRun, withTriggers });
    console.log(`    triggers done (${report.triggers?.triggers ?? 0})`);
  } finally {
    await client.end();
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const withTriggers = args.includes('--with-triggers');
  const explicit = args.filter((a) => a !== '--dry-run' && a !== '--with-triggers');
  const databases = explicit.length ? explicit : await listEamDatabases();

  console.log(
    `[enforce-table-id-conventions] ${dryRun ? 'DRY-RUN ' : ''}dbs (${databases.length}): ${databases.join(', ')}`,
  );

  let totalUpcased = 0;
  let totalConstraints = 0;
  let totalErrors = 0;

  for (const db of databases) {
    console.log(`  … starting ${db}`);
    try {
      const report = await processDb(db, { dryRun, withTriggers });
      const upcased = report.uppercased.reduce((n, r) => n + r.updated, 0);
      const constraints = report.constraints.filter((c) => c.added).length;
      totalUpcased += upcased;
      totalConstraints += constraints;
      totalErrors += report.errors.length;
      console.log(
        `  ${db}: upcased=${upcased} checks=${constraints} triggers=${report.triggers?.triggers ?? 0} errors=${report.errors.length}`,
      );
      for (const u of report.uppercased) {
        console.log(`    uppercase ${u.table}.${u.column}: ${u.updated} (${(u.samples || []).join(', ')})`);
      }
      for (const e of report.errors.slice(0, 5)) {
        console.log(`    ERR ${e.table}.${e.column}: ${e.message}`);
      }
    } catch (err) {
      totalErrors += 1;
      console.error(`  ${db}: FAILED ${err.message}`);
    }
  }

  console.log(
    `[enforce-table-id-conventions] done. upcased=${totalUpcased} checks=${totalConstraints} errors=${totalErrors}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
