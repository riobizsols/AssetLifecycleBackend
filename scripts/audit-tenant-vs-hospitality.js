#!/usr/bin/env node
/**
 * Detailed tenant vs hospitality audit: schema, row counts, ID formats, master data.
 * Usage: node scripts/audit-tenant-vs-hospitality.js [tenant_db_name]
 *
 * Reports written to: scripts/reports/tenant-audit-<tenant>-<timestamp>.json
 *                     scripts/reports/tenant-audit-<tenant>-<timestamp>.md
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool, Client } = require('pg');

const tenantDb = process.argv[2] || 'skasc_db';
const REPORT_DIR = path.join(__dirname, 'reports');

function referenceUrl() {
  return (
    process.env.TENANT_SCHEMA_REFERENCE_URL ||
    process.env.DATABASE_URL ||
    process.env.HOSPITALITY_DATABASE_URL
  );
}

function tenantUrl(name) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?|$)/, `/${name}$2`);
}

const { ID_FORMAT_RULES } = require('../constants/idFormatRules');

const REQUIRED_MASTER_TABLES = [
  'tblOrgs',
  'tblOrgSettings',
  'tblUsers',
  'tblUserJobRoles',
  'tblJobRoles',
  'tblJobRoleNav',
  'tblApps',
  'tblIDSequences',
  'tblJobs',
  'tblJobHistory',
  'tblMaintTypes',
  'tblMaintStatus',
  'tblStatusCodes',
  'tblTextMessagesDefault',
];

async function listObjects(pool) {
  const { rows } = await pool.query(`
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  return rows;
}

async function listColumns(pool, tableName) {
  const { rows } = await pool.query(
    `
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `,
    [tableName]
  );
  return rows;
}

async function rowCount(pool, tableName) {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM "${tableName}"`);
    return rows[0].c;
  } catch (e) {
    return { error: e.message };
  }
}

async function checkIdFormat(pool, dbLabel, { table, column, pattern, example }) {
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
  try {
    const exists = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name=$1
       ) AS e`,
      [table]
    );
    if (!exists.rows[0].e) {
      result.status = 'TABLE_MISSING';
      return result;
    }
    const total = await pool.query(`SELECT COUNT(*)::int AS c FROM "${table}"`);
    result.totalRows = total.rows[0].c;
    if (result.totalRows === 0) {
      result.status = 'EMPTY';
      return result;
    }
    const nulls = await pool.query(
      `SELECT COUNT(*)::int AS c FROM "${table}" WHERE "${column}" IS NULL`
    );
    result.nullIds = nulls.rows[0].c;
    const invalid = await pool.query(
      `SELECT "${column}" AS id FROM "${table}"
       WHERE "${column}" IS NOT NULL AND "${column}" !~ $1
       LIMIT 10`,
      [pattern.source]
    );
    const invalidCount = await pool.query(
      `SELECT COUNT(*)::int AS c FROM "${table}"
       WHERE "${column}" IS NOT NULL AND "${column}" !~ $1`,
      [pattern.source]
    );
    result.invalidRows = invalidCount.rows[0].c;
    result.invalidSamples = invalid.rows.map((r) => r.id);
    if (result.nullIds > 0 || result.invalidRows > 0) result.status = 'INVALID_IDS';
  } catch (e) {
    result.status = 'ERROR';
    result.error = e.message;
  }
  return result;
}

function compareColumns(refCols, tenantCols) {
  const refMap = new Map(refCols.map((c) => [c.column_name, c]));
  const tenMap = new Map(tenantCols.map((c) => [c.column_name, c]));
  const missingInTenant = [];
  const extraInTenant = [];
  const typeMismatches = [];

  for (const [name, col] of refMap) {
    if (!tenMap.has(name)) missingInTenant.push(name);
    else {
      const t = tenMap.get(name);
      if (col.data_type !== t.data_type) {
        typeMismatches.push({
          column: name,
          hospitality: col.data_type,
          tenant: t.data_type,
        });
      }
    }
  }
  for (const name of tenMap.keys()) {
    if (!refMap.has(name)) extraInTenant.push(name);
  }
  return { missingInTenant, extraInTenant, typeMismatches };
}

async function auditSkascMasterData(tenantPool) {
  const checks = [];

  const org = await tenantPool.query(`SELECT org_id, text FROM "tblOrgs" ORDER BY org_id`);
  checks.push({
    check: 'Organizations',
    status: org.rows.length > 0 ? 'OK' : 'MISSING',
    count: org.rows.length,
    rows: org.rows,
  });

  const users = await tenantPool.query(`
    SELECT u.user_id, u.email, u.full_name, u.job_role_id, u.org_id, u.int_status
    FROM "tblUsers" u ORDER BY u.user_id
  `);
  checks.push({
    check: 'Users',
    status: users.rows.length > 0 ? 'OK' : 'MISSING',
    count: users.rows.length,
    rows: users.rows,
  });

  const roles = await tenantPool.query(`
    SELECT job_role_id, text, job_function, int_status FROM "tblJobRoles" ORDER BY job_role_id
  `);
  checks.push({
    check: 'Job Roles',
    status: roles.rows.length > 0 ? 'OK' : 'MISSING',
    count: roles.rows.length,
    rows: roles.rows,
  });

  const jobs = await tenantPool.query(`
    SELECT job_id, job_name, frequency, status FROM "tblJobs" ORDER BY job_id
  `);
  checks.push({
    check: 'Cron Jobs (Job Monitor)',
    status: jobs.rows.length >= 7 ? 'OK' : jobs.rows.length > 0 ? 'PARTIAL' : 'MISSING',
    expected: 7,
    count: jobs.rows.length,
    rows: jobs.rows,
  });

  const navByRole = await tenantPool.query(`
    SELECT job_role_id, COUNT(*)::int AS nav_count
    FROM "tblJobRoleNav" WHERE int_status = 1
    GROUP BY job_role_id ORDER BY job_role_id
  `);
  checks.push({
    check: 'Job Role Navigation (per role)',
    status: navByRole.rows.length > 0 ? 'OK' : 'MISSING',
    rows: navByRole.rows,
  });

  const sequences = await tenantPool.query(`
    SELECT table_key, prefix, last_number FROM "tblIDSequences" ORDER BY table_key
  `);
  checks.push({
    check: 'ID Sequences',
    status: sequences.rows.length > 0 ? 'OK' : 'MISSING',
    count: sequences.rows.length,
    rows: sequences.rows,
  });

  try {
    const settings = await tenantPool.query(`
      SELECT * FROM "tblOrgSettings" LIMIT 3
    `);
    checks.push({
      check: 'Org Settings',
      status: settings.rows.length > 0 ? 'OK' : 'MISSING',
      count: settings.rows.length,
      rows: settings.rows,
    });
  } catch (e) {
    checks.push({
      check: 'Org Settings',
      status: 'ERROR',
      error: e.message,
    });
  }

  return checks;
}

function mdReport(report) {
  const lines = [];
  lines.push(`# Tenant Database Audit Report`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Generated | ${report.generatedAt} |`);
  lines.push(`| Reference DB | hospitality |`);
  lines.push(`| Tenant DB | ${report.tenantDb} |`);
  lines.push(`| Schema match | ${report.summary.schemaMatch ? '✅ Yes' : '❌ No'} |`);
  lines.push(`| Tables (base) | hospitality ${report.summary.hospitalityBaseTables} / tenant ${report.summary.tenantBaseTables} |`);
  lines.push(`| Missing tables in tenant | ${report.schema.missingInTenant.length} |`);
  lines.push(`| Extra tables in tenant | ${report.schema.extraInTenant.length} |`);
  lines.push(`| Column mismatches | ${report.schema.columnMismatches.length} tables |`);
  lines.push('');

  if (report.schema.missingInTenant.length) {
    lines.push('## ❌ Missing tables in tenant');
    report.schema.missingInTenant.forEach((t) => lines.push(`- \`${t.name}\` (hospitality type: ${t.type})`));
    lines.push('');
  }

  if (report.schema.extraInTenant.length) {
    lines.push('## ⚠️ Extra tables in tenant (not in hospitality)');
    report.schema.extraInTenant.forEach((t) => lines.push(`- \`${t.name}\` (tenant type: ${t.type})`));
    lines.push('');
  }

  if (report.schema.incorrectObjectTypes.length) {
    lines.push('## ❌ Incorrect object types (table vs view)');
    report.schema.incorrectObjectTypes.forEach((x) => {
      lines.push(`- \`${x.name}\`: hospitality=${x.hospitalityType}, tenant=${x.tenantType}`);
    });
    lines.push('');
  }

  if (report.schema.columnMismatches.length) {
    lines.push('## ❌ Column differences vs hospitality');
    for (const m of report.schema.columnMismatches) {
      lines.push(`### \`${m.table}\``);
      if (m.missingInTenant.length) lines.push(`- Missing columns: ${m.missingInTenant.join(', ')}`);
      if (m.extraInTenant.length) lines.push(`- Extra columns: ${m.extraInTenant.join(', ')}`);
      if (m.typeMismatches.length) {
        lines.push('- Type mismatches:');
        m.typeMismatches.forEach((t) =>
          lines.push(`  - \`${t.column}\`: hospitality=${t.hospitality}, tenant=${t.tenant}`)
        );
      }
      lines.push('');
    }
  }

  lines.push('## Row counts (all shared base tables)');
  lines.push('');
  lines.push('| Table | Hospitality rows | Tenant rows | Status |');
  lines.push('|-------|------------------:|------------:|--------|');
  for (const r of report.data.rowCounts) {
    const status =
      r.tenantError ? 'ERROR' :
      r.tenantCount === 0 && r.hospitalityCount > 0 ? 'EMPTY (hosp has data)' :
      r.tenantCount > 0 && r.hospitalityCount === 0 ? 'TENANT ONLY' :
      'OK';
    lines.push(
      `| ${r.table} | ${r.hospitalityCount} | ${r.tenantError ? r.tenantError : r.tenantCount} | ${status} |`
    );
  }
  lines.push('');

  lines.push('## ID format validation (tenant)');
  lines.push('');
  lines.push('| Table | Column | Rows | Invalid | Null IDs | Status |');
  lines.push('|-------|--------|-----:|--------:|---------:|--------|');
  for (const id of report.data.idFormatsTenant) {
    lines.push(
      `| ${id.table} | ${id.column} | ${id.totalRows} | ${id.invalidRows} | ${id.nullIds} | ${id.status} |`
    );
    if (id.invalidSamples?.length) {
      lines.push(`| | invalid samples | | ${id.invalidSamples.join(', ')} | | |`);
    }
  }
  lines.push('');

  lines.push(`## SKASC master data checks (${report.tenantDb})`);
  lines.push('');
  for (const c of report.data.masterDataChecks) {
    lines.push(`### ${c.check} — ${c.status}`);
    if (c.count !== undefined) lines.push(`Count: ${c.count}${c.expected ? ` (expected ≥ ${c.expected})` : ''}`);
    if (c.rows?.length) {
      lines.push('```json');
      lines.push(JSON.stringify(c.rows, null, 2));
      lines.push('```');
    }
    lines.push('');
  }

  lines.push('## Full table inventory');
  lines.push('');
  lines.push('### Hospitality');
  report.inventory.hospitality.forEach((t) => lines.push(`- \`${t.name}\` (${t.type})`));
  lines.push('');
  lines.push('### Tenant');
  report.inventory.tenant.forEach((t) => lines.push(`- \`${t.name}\` (${t.type})`));

  return lines.join('\n');
}

async function main() {
  const refPool = new Pool({ connectionString: referenceUrl(), ssl: false });
  const tenantPool = new Pool({ connectionString: tenantUrl(tenantDb), ssl: false });

  const report = {
    generatedAt: new Date().toISOString(),
    tenantDb,
    referenceDb: 'hospitality',
    reportPaths: {},
    summary: {},
    schema: {
      missingInTenant: [],
      extraInTenant: [],
      incorrectObjectTypes: [],
      columnMismatches: [],
    },
    data: {
      rowCounts: [],
      idFormatsTenant: [],
      idFormatsHospitality: [],
      masterDataChecks: [],
    },
    inventory: { hospitality: [], tenant: [] },
  };

  try {
    const refObjects = await listObjects(refPool);
    const tenObjects = await listObjects(tenantPool);

    report.inventory.hospitality = refObjects.map((r) => ({ name: r.table_name, type: r.table_type }));
    report.inventory.tenant = tenObjects.map((r) => ({ name: r.table_name, type: r.table_type }));

    const refMap = new Map(refObjects.map((r) => [r.table_name, r.table_type]));
    const tenMap = new Map(tenObjects.map((r) => [r.table_name, r.table_type]));

    for (const [name, type] of refMap) {
      if (!tenMap.has(name)) {
        report.schema.missingInTenant.push({ name, type });
      } else if (tenMap.get(name) !== type) {
        report.schema.incorrectObjectTypes.push({
          name,
          hospitalityType: type,
          tenantType: tenMap.get(name),
        });
      }
    }
    for (const [name, type] of tenMap) {
      if (!refMap.has(name)) report.schema.extraInTenant.push({ name, type });
    }

    const sharedBaseTables = [...refMap.entries()]
      .filter(([name, type]) => type === 'BASE TABLE' && tenMap.get(name) === 'BASE TABLE')
      .map(([name]) => name)
      .sort();

    report.summary.hospitalityBaseTables = [...refMap.values()].filter((t) => t === 'BASE TABLE').length;
    report.summary.tenantBaseTables = [...tenMap.values()].filter((t) => t === 'BASE TABLE').length;

    for (const table of sharedBaseTables) {
      const refCols = await listColumns(refPool, table);
      const tenCols = await listColumns(tenantPool, table);
      const cmp = compareColumns(refCols, tenCols);
      if (cmp.missingInTenant.length || cmp.extraInTenant.length || cmp.typeMismatches.length) {
        report.schema.columnMismatches.push({ table, ...cmp });
      }

      const hCount = await rowCount(refPool, table);
      const tCount = await rowCount(tenantPool, table);
      report.data.rowCounts.push({
        table,
        hospitalityCount: typeof hCount === 'number' ? hCount : 0,
        tenantCount: typeof tCount === 'number' ? tCount : 0,
        tenantError: typeof tCount === 'object' ? tCount.error : null,
        requiredMaster: REQUIRED_MASTER_TABLES.includes(table),
      });
    }

    for (const check of ID_FORMAT_RULES) {
      report.data.idFormatsTenant.push(await checkIdFormat(tenantPool, tenantDb, check));
      report.data.idFormatsHospitality.push(await checkIdFormat(refPool, 'hospitality', check));
    }

    report.data.masterDataChecks = await auditSkascMasterData(tenantPool);

    report.summary.schemaMatch =
      report.schema.missingInTenant.length === 0 &&
      report.schema.extraInTenant.length === 0 &&
      report.schema.incorrectObjectTypes.length === 0 &&
      report.schema.columnMismatches.length === 0;

    const ts = report.generatedAt.replace(/[:.]/g, '-').slice(0, 19);
    if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

    const jsonPath = path.join(REPORT_DIR, `tenant-audit-${tenantDb}-${ts}.json`);
    const mdPath = path.join(REPORT_DIR, `tenant-audit-${tenantDb}-${ts}.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(mdPath, mdReport(report));

    report.reportPaths = { json: jsonPath, markdown: mdPath };
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    console.log('Audit complete.');
    console.log('JSON report:', jsonPath);
    console.log('Markdown report:', mdPath);
    console.log('');
    console.log('Summary:');
    console.log('  Schema match:', report.summary.schemaMatch ? 'YES' : 'NO');
    console.log('  Missing tables:', report.schema.missingInTenant.length);
    console.log('  Extra tables:', report.schema.extraInTenant.length);
    console.log('  Wrong table/view types:', report.schema.incorrectObjectTypes.length);
    console.log('  Tables with column diffs:', report.schema.columnMismatches.length);
    console.log('  ID format issues (tenant):', report.data.idFormatsTenant.filter((x) => x.status === 'INVALID_IDS').length);
  } finally {
    await refPool.end();
    await tenantPool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
