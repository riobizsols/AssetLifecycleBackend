const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const {
  ID_FORMAT_RULES,
  SEQUENCE_TABLE_MAP,
  LEGACY_ID_REMAPS,
} = require('../constants/idFormatRules');

const REPORT_DIR = path.join(__dirname, '..', 'scripts', 'reports');

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
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

async function checkIdFormat(client, dbLabel, rule) {
  const { table, column, pattern, example } = rule;
  const result = {
    table,
    column,
    expectedPattern: pattern.toString(),
    example,
    db: dbLabel,
    totalRows: 0,
    invalidRows: 0,
    invalidSamples: [],
    nullIds: 0,
    status: 'OK',
  };

  if (!(await tableExists(client, table))) {
    result.status = 'TABLE_MISSING';
    return result;
  }

  const total = await client.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
  result.totalRows = total.rows[0].c;
  if (result.totalRows === 0) {
    result.status = 'EMPTY';
    return result;
  }

  const nulls = await client.query(
    `SELECT COUNT(*)::int AS c FROM "${table}" WHERE "${column}" IS NULL`
  );
  result.nullIds = nulls.rows[0].c;

  const invalid = await client.query(
    `SELECT "${column}" AS id FROM "${table}"
     WHERE "${column}" IS NOT NULL AND "${column}" !~ $1
     LIMIT 10`,
    [pattern.source]
  );
  const invalidCount = await client.query(
    `SELECT COUNT(*)::int AS c FROM "${table}"
     WHERE "${column}" IS NOT NULL AND "${column}" !~ $1`,
    [pattern.source]
  );
  result.invalidRows = invalidCount.rows[0].c;
  result.invalidSamples = invalid.rows.map((r) => r.id);
  if (result.nullIds > 0 || result.invalidRows > 0) result.status = 'INVALID_IDS';
  return result;
}

async function auditIdFormats(client, dbLabel) {
  const results = [];
  for (const rule of ID_FORMAT_RULES) {
    results.push(await checkIdFormat(client, dbLabel, rule));
  }
  return results;
}

/**
 * Remap a legacy bad ID and update FK references in one transaction.
 * For PK changes with inbound FKs: insert new row → repoint FKs → delete old row.
 */
async function applyLegacyRemap(client, remap) {
  const log = { ...remap, fkChanges: [], status: 'skipped' };

  const exists = await client.query(
    `SELECT * FROM "${remap.primaryTable}" WHERE "${remap.primaryColumn}" = $1`,
    [remap.from]
  );
  if (exists.rows.length === 0) return log;

  const targetTaken = await client.query(
    `SELECT 1 FROM "${remap.primaryTable}" WHERE "${remap.primaryColumn}" = $1`,
    [remap.to]
  );
  if (targetTaken.rows.length > 0) {
    log.status = 'failed';
    log.error = `Target ID ${remap.to} already exists`;
    return log;
  }

  const oldRow = exists.rows[0];
  const newRow = { ...oldRow, [remap.primaryColumn]: remap.to, ...(remap.primaryExtra || {}) };

  // Discover inbound FK columns pointing at this PK (same column name in child tables)
  const fkTables =
    remap.fkUpdates ||
    (
      await client.query(
        `
        SELECT DISTINCT tc.table_name AS child_table, kcu.column_name AS child_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = $1
          AND ccu.column_name = $2
      `,
        [remap.primaryTable, remap.primaryColumn]
      )
    ).rows.map((r) => ({ table: r.child_table, column: r.child_column }));

  // Insert new primary row with target ID
  const pkCols = Object.keys(newRow);
  const pkVals = pkCols.map((c) => newRow[c]);
  await client.query(
    `INSERT INTO "${remap.primaryTable}" (${pkCols.map((c) => `"${c}"`).join(', ')})
     VALUES (${pkVals.map((_, i) => `$${i + 1}`).join(', ')})`,
    pkVals
  );

  for (const fk of fkTables) {
    if (!(await tableExists(client, fk.table))) continue;
    const res = await client.query(
      `UPDATE "${fk.table}" SET "${fk.column}" = $1 WHERE "${fk.column}" = $2`,
      [remap.to, remap.from]
    );
    log.fkChanges.push({ table: fk.table, column: fk.column, rows: res.rowCount });
  }

  await client.query(
    `DELETE FROM "${remap.primaryTable}" WHERE "${remap.primaryColumn}" = $1`,
    [remap.from]
  );

  log.status = 'applied';
  return log;
}

/**
 * Set tblIDSequences.last_number to the max numeric suffix found in each table.
 */
async function syncIdSequencesFromData(client) {
  const updates = [];

  for (const [tableKey, mapping] of Object.entries(SEQUENCE_TABLE_MAP)) {
    if (!(await tableExists(client, mapping.table))) continue;

    const escaped = mapping.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const { rows } = await client.query(
      `
      SELECT COALESCE(MAX(
        CAST(SUBSTRING("${mapping.column}" FROM '${escaped}(\\d+)$') AS INTEGER)
      ), 0)::int AS max_n
      FROM "${mapping.table}"
      WHERE "${mapping.column}" ~ $1
    `,
      [`^${escaped}\\d+$`]
    );

    const maxN = rows[0]?.max_n || 0;
    const seq = await client.query(
      `SELECT last_number FROM "tblIDSequences" WHERE table_key = $1`,
      [tableKey]
    );
    const before = seq.rows[0]?.last_number ?? null;

    await client.query(
      `
      INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
      VALUES ($1, $2, $3)
      ON CONFLICT (table_key) DO UPDATE
      SET prefix = EXCLUDED.prefix,
          last_number = EXCLUDED.last_number
    `,
      [tableKey, mapping.prefix, maxN]
    );

    updates.push({
      tableKey,
      table: mapping.table,
      column: mapping.column,
      prefix: mapping.prefix,
      maxInTable: maxN,
      sequenceBefore: before,
      sequenceAfter: maxN,
    });
  }

  return updates;
}

async function fixTenantIdFormats(client, options = {}) {
  const remapLogs = [];
  for (const remap of LEGACY_ID_REMAPS) {
    remapLogs.push(await applyLegacyRemap(client, remap));
  }

  const sequenceSync = options.syncSequences !== false
    ? await syncIdSequencesFromData(client)
    : [];

  const idAudit = await auditIdFormats(client, options.dbLabel || 'tenant');

  const invalidCount = idAudit.filter((r) => r.status === 'INVALID_IDS').length;

  return {
    remapLogs,
    sequenceSync,
    idAudit,
    invalidCount,
  };
}

function writeIdFormatReport(tenantDb, result) {
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(REPORT_DIR, `id-format-fix-${tenantDb}-${ts}.json`);
  const mdPath = path.join(REPORT_DIR, `id-format-fix-${tenantDb}-${ts}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify({ tenantDb, generatedAt: new Date().toISOString(), ...result }, null, 2));

  const lines = [
    `# ID Format Fix Report — ${tenantDb}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Canonical formats (from idGenerator / tblIDSequences)',
    '',
    '| Entity | Pattern | Example |',
    '|--------|---------|---------|',
    ...ID_FORMAT_RULES.map((r) => `| ${r.table}.${r.column} | ${r.pattern} | ${r.example} |`),
    '',
    '## Legacy remaps applied',
    '',
  ];

  for (const r of result.remapLogs) {
    if (r.status === 'applied') {
      lines.push(`- ✅ ${r.label}: ${r.from} → ${r.to}`);
      for (const fk of r.fkChanges || []) {
        lines.push(`  - Updated ${fk.table}.${fk.column}: ${fk.rows} row(s)`);
      }
    } else if (r.status === 'skipped') {
      lines.push(`- ⏭️ ${r.label}: not present`);
    } else {
      lines.push(`- ❌ ${r.label}: ${r.error || r.status}`);
    }
  }

  lines.push('', '## Post-fix audit', '');
  lines.push('| Table | Column | Status | Invalid | Samples |');
  lines.push('|-------|--------|--------|---------|---------|');
  for (const r of result.idAudit) {
    lines.push(
      `| ${r.table} | ${r.column} | ${r.status} | ${r.invalidRows} | ${(r.invalidSamples || []).join(', ') || '—'} |`
    );
  }

  lines.push('', `**Invalid tables remaining:** ${result.invalidCount}`, '');
  fs.writeFileSync(mdPath, lines.join('\n'));

  return { jsonPath, mdPath };
}

async function fixTenantDatabase(dbName, options = {}) {
  const client = new Client({ connectionString: tenantUrl(dbName), ssl: false });
  await client.connect();
  try {
    await client.query('BEGIN');
    const result = await fixTenantIdFormats(client, { dbLabel: dbName, ...options });
    await client.query('COMMIT');
    const reportPaths = writeIdFormatReport(dbName, result);
    return { ...result, reportPaths };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

module.exports = {
  auditIdFormats,
  checkIdFormat,
  applyLegacyRemap,
  syncIdSequencesFromData,
  fixTenantIdFormats,
  fixTenantDatabase,
  writeIdFormatReport,
};
