#!/usr/bin/env node
/**
 * Align skasc_db column definitions with hospitality reference.
 * Usage: node scripts/migrate-skasc-columns-from-hospitality.js [tenant_db_name]
 *
 * Writes migration log to scripts/reports/column-migration-<tenant>-<timestamp>.json
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool, Client } = require('pg');

const tenantDb = process.argv[2] || 'skasc_db';
const REPORT_DIR = path.join(__dirname, 'reports');

function referenceUrl() {
  return process.env.TENANT_SCHEMA_REFERENCE_URL || process.env.DATABASE_URL;
}

function tenantUrl(name) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?|$)/, `/${name}$2`);
}

function pgType(col) {
  let t = col.data_type;
  if (t === 'character varying' && col.character_maximum_length) {
    return `character varying(${col.character_maximum_length})`;
  }
  if (t === 'character' && col.character_maximum_length) {
    return `character(${col.character_maximum_length})`;
  }
  if (t === 'numeric' && col.numeric_precision) {
    return col.numeric_scale != null
      ? `numeric(${col.numeric_precision},${col.numeric_scale})`
      : `numeric(${col.numeric_precision})`;
  }
  if (t === 'ARRAY') return col.udt_name === '_text' ? 'text[]' : col.udt_name;
  if (t === 'USER-DEFINED') return col.udt_name;
  if (t === 'timestamp without time zone') return 'timestamp without time zone';
  if (t === 'timestamp with time zone') return 'timestamp with time zone';
  return t;
}

function usingExpr(colName, fromType, toType, pgTarget) {
  const n = `"${colName}"`;
  if (fromType === 'text' && toType === 'character varying') return `${n}::character varying`;
  if (fromType === 'character varying' && toType === 'text') return `${n}::text`;
  if (fromType === 'text' && toType === 'date') return `CASE WHEN ${n} ~ '^\\d{4}-\\d{2}-\\d{2}' THEN ${n}::date ELSE NULL END`;
  if (fromType === 'character varying' && toType === 'integer') return `CASE WHEN ${n} ~ '^-?\\d+$' THEN ${n}::integer ELSE NULL END`;
  if (fromType === 'text' && toType === 'integer') return `CASE WHEN ${n} ~ '^-?\\d+$' THEN ${n}::integer ELSE NULL END`;
  if (fromType === 'timestamp without time zone' && toType === 'character varying') return `to_char(${n}, 'YYYY-MM-DD HH24:MI:SS')`;
  if (fromType === 'character varying' && toType === 'timestamp without time zone') return `${n}::timestamp without time zone`;
  return `${n}::${pgTarget}`;
}

async function getColumns(pool, table) {
  const { rows } = await pool.query(
    `
    SELECT column_name, data_type, character_maximum_length, numeric_precision, numeric_scale,
           is_nullable, column_default, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `,
    [table]
  );
  return rows;
}

async function compareAndBuildPlan(refPool, tenantPool) {
  const refTables = await refPool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
  `);
  const plan = [];

  for (const { table_name: table } of refTables.rows) {
    const refCols = await getColumns(refPool, table);
    const tenCols = await getColumns(tenantPool, table);
    const refMap = new Map(refCols.map((c) => [c.column_name, c]));
    const tenMap = new Map(tenCols.map((c) => [c.column_name, c]));

    for (const [name, refCol] of refMap) {
      if (!tenMap.has(name)) {
        plan.push({
          action: 'ADD_COLUMN',
          table,
          column: name,
          sqlType: pgType(refCol),
          nullable: refCol.is_nullable === 'YES',
          default: refCol.column_default,
        });
      } else {
        const tenCol = tenMap.get(name);
        const refType = pgType(refCol);
        const tenType = pgType(tenCol);
        if (refType !== tenType || refCol.data_type !== tenCol.data_type) {
          plan.push({
            action: 'ALTER_TYPE',
            table,
            column: name,
            from: tenType,
            to: refType,
            hospitalityDataType: refCol.data_type,
            tenantDataType: tenCol.data_type,
          });
        }
      }
    }

    for (const name of tenMap.keys()) {
      if (!refMap.has(name)) {
        plan.push({ action: 'DROP_COLUMN', table, column: name });
      }
    }
  }

  return plan;
}

function buildSql(item) {
  const q = (id) => `"${id}"`;
  if (item.action === 'ADD_COLUMN') {
    let sql = `ALTER TABLE ${q(item.table)} ADD COLUMN IF NOT EXISTS ${q(item.column)} ${item.sqlType}`;
    if (item.default) {
      let d = item.default.replace(/::[a-zA-Z_ ]+(\[\])?/g, '');
      sql += ` DEFAULT ${d}`;
    }
    if (!item.nullable && !item.default) {
      // Add nullable first when no default — avoids failure on non-empty tables
      sql = `ALTER TABLE ${q(item.table)} ADD COLUMN IF NOT EXISTS ${q(item.column)} ${item.sqlType}`;
    } else if (!item.nullable) {
      sql += ' NOT NULL';
    }
    return sql + ';';
  }
  if (item.action === 'ALTER_TYPE') {
    const using = usingExpr(item.column, item.tenantDataType, item.hospitalityDataType, item.to);
    const col = q(item.column);
    const pre =
      item.hospitalityDataType === 'integer' && item.tenantDataType === 'character varying'
        ? `ALTER TABLE ${q(item.table)} ALTER COLUMN ${col} DROP DEFAULT;`
        : null;
    const alter = `ALTER TABLE ${q(item.table)} ALTER COLUMN ${col} TYPE ${item.to} USING (${using});`;
    return pre ? [pre, alter] : [alter];
  }
  if (item.action === 'DROP_COLUMN') {
    return [`ALTER TABLE ${q(item.table)} DROP COLUMN IF EXISTS ${q(item.column)} CASCADE;`];
  }
  return [];
}

async function main() {
  const refPool = new Pool({ connectionString: referenceUrl(), ssl: false });
  const tenantPool = new Pool({ connectionString: tenantUrl(tenantDb), ssl: false });

  const fullPlan = await compareAndBuildPlan(refPool, tenantPool);

  // Only tables that were in the original 26-table audit (non-trivial diffs)
  const affectedTables = new Set([
    'tblAAT_Insp_Sch', 'tblATMaintCert', 'tblATMaintFreq', 'tblAssetBRDet', 'tblAssetDepHist',
    'tblAssetMaintSch', 'tblAssetScrapDet', 'tblAssetTypes', 'tblAssetWarrantyNotify', 'tblAssets',
    'tblDepreciationSettings', 'tblDeptAdmins', 'tblEmpTechCert', 'tblJobRoleNav', 'tblMaintTypes',
    'tblProdServs', 'tblScrapAssetHist', 'tblTechCert', 'tblUom', 'tblVendorProdService',
    'tblVendorSLAs', 'tblWFAssetMaintHist', 'tblWFAssetMaintSch_D', 'tblWFJobRole',
    'tblWFScrap_D', 'tblWFScrap_H',
  ]);

  const plan = fullPlan.filter((p) => affectedTables.has(p.table));

  const log = {
    generatedAt: new Date().toISOString(),
    tenantDb,
    referenceDb: 'hospitality',
    tablesAffected: [...affectedTables].sort(),
    totalActions: plan.length,
    actions: [],
    errors: [],
  };

  const client = new Client({ connectionString: tenantUrl(tenantDb), ssl: false });
  await client.connect();

  try {
    for (const item of plan) {
      const statements = buildSql(item);
      const sqlList = Array.isArray(statements) ? statements : statements ? [statements] : [];
      for (const sql of sqlList) {
        const entry = { ...item, sql, status: 'pending' };
        try {
          await client.query(sql);
          entry.status = 'applied';
          log.actions.push(entry);
          console.log(`✅ ${item.action} ${item.table}.${item.column}`);
        } catch (err) {
          entry.status = 'failed';
          entry.error = err.message;
          log.actions.push(entry);
          log.errors.push({ ...item, error: err.message, sql });
          console.warn(`⚠️ ${item.action} ${item.table}.${item.column}: ${err.message}`);
        }
      }
    }
  } finally {
    await client.end();
  }

  await refPool.end();
  await tenantPool.end();

  log.summary = {
    applied: log.actions.filter((a) => a.status === 'applied').length,
    failed: log.actions.filter((a) => a.status === 'failed').length,
    added: log.actions.filter((a) => a.action === 'ADD_COLUMN' && a.status === 'applied').length,
    altered: log.actions.filter((a) => a.action === 'ALTER_TYPE' && a.status === 'applied').length,
    dropped: log.actions.filter((a) => a.action === 'DROP_COLUMN' && a.status === 'applied').length,
  };

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const ts = log.generatedAt.replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = path.join(REPORT_DIR, `column-migration-${tenantDb}-${ts}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(log, null, 2));

  // Human-readable summary grouped by table
  const byTable = {};
  for (const a of log.actions) {
    if (!byTable[a.table]) byTable[a.table] = [];
    byTable[a.table].push(a);
  }
  const mdLines = [
    `# Column Migration Report — ${tenantDb}`,
    '',
    `Generated: ${log.generatedAt}`,
    '',
    `Applied: ${log.summary.applied} | Failed: ${log.summary.failed}`,
    `Added columns: ${log.summary.added} | Type changes: ${log.summary.altered} | Dropped columns: ${log.summary.dropped}`,
    '',
  ];
  for (const table of Object.keys(byTable).sort()) {
    mdLines.push(`## ${table}`);
    for (const a of byTable[table]) {
      if (a.action === 'ADD_COLUMN') mdLines.push(`- ➕ ADD \`${a.column}\` (${a.sqlType}) — ${a.status}`);
      if (a.action === 'ALTER_TYPE') mdLines.push(`- 🔄 TYPE \`${a.column}\`: ${a.from} → ${a.to} — ${a.status}`);
      if (a.action === 'DROP_COLUMN') mdLines.push(`- ➖ DROP \`${a.column}\` — ${a.status}`);
    }
    mdLines.push('');
  }
  const mdPath = path.join(REPORT_DIR, `column-migration-${tenantDb}-${ts}.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log('\nMigration log:', reportPath);
  console.log('Summary markdown:', mdPath);
  console.log('Summary:', log.summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
