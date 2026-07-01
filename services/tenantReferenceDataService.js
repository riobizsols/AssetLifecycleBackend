const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { isLegacyGroupMenuAppId } = require('../utils/navigationGroupUtils');

const REPORT_DIR = path.join(__dirname, '..', 'scripts', 'reports');

function getReferenceUrl() {
  return (
    process.env.TENANT_SCHEMA_REFERENCE_URL ||
    process.env.DATABASE_URL ||
    process.env.HOSPITALITY_DATABASE_URL
  );
}

/** Tables that must be seeded from hospitality on every new tenant. */
const REQUIRED_MASTER_TABLES = [
  { table: 'tblTextMessagesDefault', pk: ['tmd_id'] },
  { table: 'tblTextMessagesOtherLangs', pk: ['tmol_id'] },
  { table: 'tblStatusCodes', pk: ['id'] },
  { table: 'tblProps', pk: ['prop_id'] },
  { table: 'tblUom', pk: ['uom_id'] },
  { table: 'tblApps', pk: ['app_id'], orgIdColumn: 'org_id', missingOnly: true },
];

/** Legacy tenants cloned from assetLifecycle needed column fixes on these tables. */
const COLUMN_ALIGN_TABLES = new Set([
  'tblAAT_Insp_Sch', 'tblATMaintCert', 'tblATMaintFreq', 'tblAssetBRDet', 'tblAssetDepHist',
  'tblAssetMaintSch', 'tblAssetScrapDet', 'tblAssetTypes', 'tblAssetWarrantyNotify', 'tblAssets',
  'tblDepreciationSettings', 'tblDeptAdmins', 'tblEmpTechCert', 'tblJobRoleNav', 'tblMaintTypes',
  'tblProdServs', 'tblScrapAssetHist', 'tblTechCert', 'tblUom', 'tblVendorProdService',
  'tblVendorSLAs', 'tblWFAssetMaintHist', 'tblWFAssetMaintSch_D', 'tblWFJobRole',
  'tblWFScrap_D', 'tblWFScrap_H',
]);

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

async function getTableColumns(client, tableName) {
  const { rows } = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `,
    [tableName]
  );
  return rows.map((r) => r.column_name);
}

async function getPrimaryKeyColumns(client, tableName) {
  const { rows } = await client.query(
    `
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = $1
    ORDER BY kcu.ordinal_position
  `,
    [tableName]
  );
  return rows.map((r) => r.column_name);
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS e
  `,
    [tableName]
  );
  return rows[0].e;
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
  if (fromType === 'text' && toType === 'date') {
    return `CASE WHEN ${n} ~ '^\\d{4}-\\d{2}-\\d{2}' THEN ${n}::date ELSE NULL END`;
  }
  if (fromType === 'character varying' && toType === 'integer') {
    return `CASE WHEN ${n} ~ '^-?\\d+$' THEN ${n}::integer ELSE NULL END`;
  }
  if (fromType === 'text' && toType === 'integer') {
    return `CASE WHEN ${n} ~ '^-?\\d+$' THEN ${n}::integer ELSE NULL END`;
  }
  if (fromType === 'timestamp without time zone' && toType === 'character varying') {
    return `to_char(${n}, 'YYYY-MM-DD HH24:MI:SS')`;
  }
  if (fromType === 'character varying' && toType === 'timestamp without time zone') {
    return `${n}::timestamp without time zone`;
  }
  return `${n}::${pgTarget}`;
}

async function getColumnsDetailed(client, table) {
  const { rows } = await client.query(
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

async function buildColumnAlignPlan(referenceClient, tenantClient, tableFilter = null) {
  const { rows: refTables } = await referenceClient.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
  `);
  const plan = [];

  for (const { table_name: table } of refTables) {
    if (tableFilter && !tableFilter.has(table)) continue;
    const refCols = await getColumnsDetailed(referenceClient, table);
    const tenCols = await getColumnsDetailed(tenantClient, table);
    if (tenCols.length === 0) continue;

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

function buildColumnSql(item) {
  const q = (id) => `"${id}"`;
  if (item.action === 'ADD_COLUMN') {
    let sql = `ALTER TABLE ${q(item.table)} ADD COLUMN IF NOT EXISTS ${q(item.column)} ${item.sqlType}`;
    if (item.default) {
      const d = item.default.replace(/::[a-zA-Z_ ]+(\[\])?/g, '');
      sql += ` DEFAULT ${d}`;
    }
    if (!item.nullable && !item.default) {
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

/**
 * Copy rows from reference DB into tenant for one table (missing PK rows only by default).
 */
async function copyReferenceTableRows(referenceClient, tenantClient, tableName, options = {}) {
  const {
    pk = null,
    orgIdColumn = null,
    orgId = null,
    missingOnly = true,
  } = options;

  if (!(await tableExists(referenceClient, tableName))) {
    return { table: tableName, inserted: 0, skipped: true, reason: 'missing_in_reference' };
  }
  if (!(await tableExists(tenantClient, tableName))) {
    return { table: tableName, inserted: 0, skipped: true, reason: 'missing_in_tenant' };
  }

  const refColumns = await getTableColumns(referenceClient, tableName);
  const tenantColumns = await getTableColumns(tenantClient, tableName);
  const commonColumns = tenantColumns.filter((col) => refColumns.includes(col));

  if (commonColumns.length === 0) {
    return { table: tableName, inserted: 0, skipped: true, reason: 'no_common_columns' };
  }

  const pkColumns = pk || (await getPrimaryKeyColumns(referenceClient, tableName));
  const selectCols = commonColumns.map((c) => `"${c}"`).join(', ');
  const { rows: refRows } = await referenceClient.query(
    `SELECT ${selectCols} FROM "${tableName}"`
  );

  if (refRows.length === 0) {
    return { table: tableName, inserted: 0, skipped: false, total: 0 };
  }

  let existingKeys = new Set();
  if (missingOnly && pkColumns.length > 0) {
    const pkSelect = pkColumns.map((c) => `"${c}"`).join(', ');
    const { rows: tenantRows } = await tenantClient.query(
      `SELECT ${pkSelect} FROM "${tableName}"`
    );
    existingKeys = new Set(
      tenantRows.map((row) => pkColumns.map((col) => String(row[col])).join('|'))
    );
  }

  const conflictClause =
    pkColumns.length > 0
      ? `ON CONFLICT (${pkColumns.map((c) => `"${c}"`).join(', ')}) DO NOTHING`
      : 'ON CONFLICT DO NOTHING';

  let inserted = 0;
  let skippedRows = 0;
  const errors = [];

  for (const row of refRows) {
    if (tableName === 'tblApps' && isLegacyGroupMenuAppId(row.app_id)) {
      skippedRows += 1;
      continue;
    }

    if (missingOnly && pkColumns.length > 0) {
      const key = pkColumns.map((col) => String(row[col])).join('|');
      if (existingKeys.has(key)) {
        skippedRows += 1;
        continue;
      }
    }

    const values = commonColumns.map((col) => {
      if (orgIdColumn && col === orgIdColumn && orgId) return orgId;
      return row[col];
    });

    try {
      await tenantClient.query(
        `
        INSERT INTO "${tableName}" (${commonColumns.map((c) => `"${c}"`).join(', ')})
        VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')})
        ${conflictClause}
      `,
        values
      );
      inserted += 1;
      if (pkColumns.length > 0) {
        existingKeys.add(pkColumns.map((col) => String(row[col])).join('|'));
      }
    } catch (err) {
      errors.push({ key: pkColumns.map((col) => row[col]).join('|'), error: err.message });
    }
  }

  return {
    table: tableName,
    inserted,
    skippedRows,
    total: refRows.length,
    errors,
  };
}

/**
 * Seed required master data from hospitality reference into a tenant database.
 */
async function seedRequiredMasterData(tenantClient, options = {}) {
  const referenceUrl = options.referenceUrl || getReferenceUrl();
  if (!referenceUrl) {
    throw new Error('TENANT_SCHEMA_REFERENCE_URL or DATABASE_URL must be set');
  }

  const referenceClient = new Client({ connectionString: referenceUrl, ssl: false });
  await referenceClient.connect();

  const results = [];
  try {
    await referenceClient.query('SET search_path TO public');
    await tenantClient.query('SET search_path TO public');

    for (const spec of REQUIRED_MASTER_TABLES) {
      const result = await copyReferenceTableRows(referenceClient, tenantClient, spec.table, {
        pk: spec.pk,
        orgIdColumn: spec.orgIdColumn,
        orgId: options.orgId,
        missingOnly: spec.missingOnly !== false,
      });
      results.push(result);
      console.log(
        `[TenantReferenceData] ${spec.table}: inserted ${result.inserted}, skipped ${result.skippedRows || 0}`
      );
    }

    return { results, referenceUrl: referenceUrl.replace(/:[^:@/]+@/, ':***@') };
  } finally {
    await referenceClient.end();
  }
}

/**
 * Align tenant column definitions to match hospitality reference.
 */
async function alignTenantColumnsFromReference(tenantClient, options = {}) {
  const referenceUrl = options.referenceUrl || getReferenceUrl();
  const referenceClient = new Client({ connectionString: referenceUrl, ssl: false });
  await referenceClient.connect();

  const log = {
    generatedAt: new Date().toISOString(),
    referenceDb: 'hospitality',
    actions: [],
    errors: [],
  };

  try {
    const fullPlan = await buildColumnAlignPlan(referenceClient, tenantClient, COLUMN_ALIGN_TABLES);
    log.totalActions = fullPlan.length;

    for (const item of fullPlan) {
      const statements = buildColumnSql(item);
      const sqlList = Array.isArray(statements) ? statements : statements ? [statements] : [];
      for (const sql of sqlList) {
        const entry = { ...item, sql, status: 'pending' };
        try {
          await tenantClient.query(sql);
          entry.status = 'applied';
          log.actions.push(entry);
        } catch (err) {
          entry.status = 'failed';
          entry.error = err.message;
          log.actions.push(entry);
          log.errors.push({ ...item, error: err.message, sql });
        }
      }
    }
  } finally {
    await referenceClient.end();
  }

  log.summary = {
    applied: log.actions.filter((a) => a.status === 'applied').length,
    failed: log.actions.filter((a) => a.status === 'failed').length,
    added: log.actions.filter((a) => a.action === 'ADD_COLUMN' && a.status === 'applied').length,
    altered: log.actions.filter((a) => a.action === 'ALTER_TYPE' && a.status === 'applied').length,
    dropped: log.actions.filter((a) => a.action === 'DROP_COLUMN' && a.status === 'applied').length,
  };

  return log;
}

function writeSeedReport(tenantDb, seedResult, options = {}) {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(REPORT_DIR, `seed-data-${tenantDb}-${ts}.json`);
  const mdPath = path.join(REPORT_DIR, `seed-data-${tenantDb}-${ts}.md`);

  const payload = {
    generatedAt: new Date().toISOString(),
    tenantDb,
    referenceDb: 'hospitality',
    orgId: options.orgId || null,
    tables: seedResult.results,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const lines = [
    `# Seed Data Report — ${tenantDb}`,
    '',
    `Generated: ${payload.generatedAt}`,
    `Reference: hospitality`,
    options.orgId ? `Tenant org_id: ${options.orgId}` : '',
    '',
    '| Table | Inserted | Skipped existing | Total in reference |',
    '|-------|----------|------------------|-------------------|',
  ];
  for (const r of seedResult.results) {
    lines.push(
      `| ${r.table} | ${r.inserted} | ${r.skippedRows || 0} | ${r.total ?? '—'} |`
    );
  }
  fs.writeFileSync(mdPath, lines.filter(Boolean).join('\n'));

  return { jsonPath, mdPath };
}

/**
 * CLI helper: seed reference master data for a tenant DB by name.
 */
async function seedTenantDatabase(dbName, options = {}) {
  const client = new Client({ connectionString: tenantUrl(dbName), ssl: false });
  await client.connect();
  try {
    await client.query('SET search_path TO public');

    let orgId = options.orgId;
    if (!orgId) {
      const { rows } = await client.query(`SELECT org_id FROM "tblOrgs" LIMIT 1`);
      orgId = rows[0]?.org_id || null;
    }

    const seedResult = await seedRequiredMasterData(client, { orgId, ...options });
    const reportPaths = writeSeedReport(dbName, seedResult, { orgId });
    return { ...seedResult, reportPaths, orgId };
  } finally {
    await client.end();
  }
}

module.exports = {
  getReferenceUrl,
  REQUIRED_MASTER_TABLES,
  COLUMN_ALIGN_TABLES,
  copyReferenceTableRows,
  seedRequiredMasterData,
  alignTenantColumnsFromReference,
  seedTenantDatabase,
  writeSeedReport,
  buildColumnAlignPlan,
};
