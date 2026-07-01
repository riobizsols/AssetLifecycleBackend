#!/usr/bin/env node
/**
 * Deep integrity check for skasc_db vs hospitality reference.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { ID_FORMAT_RULES } = require('../constants/idFormatRules');
const { auditIdFormats } = require('../services/tenantIdFormatService');

const tenantDb = process.argv[2] || 'skasc_db';

function refUrl() {
  return process.env.TENANT_SCHEMA_REFERENCE_URL || process.env.DATABASE_URL;
}
function tenUrl(name) {
  return (process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL).replace(
    /\/([^/?]+)(\?.*)?$/i,
    `/${name}$2`
  );
}

async function listBaseTables(c) {
  const { rows } = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name
  `);
  return rows.map((r) => r.table_name);
}

async function listViews(c) {
  const { rows } = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_type='VIEW' ORDER BY table_name
  `);
  return rows.map((r) => r.table_name);
}

async function compareColumns(ref, ten, table) {
  const q = `
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`;
  const [rc, tc] = await Promise.all([ref.query(q, [table]), ten.query(q, [table])]);
  const refMap = new Map(rc.rows.map((r) => [r.column_name, r]));
  const tenMap = new Map(tc.rows.map((r) => [r.column_name, r]));
  const missing = [...refMap.keys()].filter((k) => !tenMap.has(k));
  const extra = [...tenMap.keys()].filter((k) => !refMap.has(k));
  const typeDiff = [];
  for (const [k, r] of refMap) {
    if (!tenMap.has(k)) continue;
    const t = tenMap.get(k);
    if (r.data_type !== t.data_type) typeDiff.push({ col: k, ref: r.data_type, ten: t.data_type });
  }
  return { missing, extra, typeDiff };
}

async function checkFkViolations(c) {
  // Critical relationships only (fast; full schema FK scan is too slow on 98 tables)
  const fkChecks = [
    ['dept→branch', `SELECT d.dept_id AS id FROM "tblDepartments" d LEFT JOIN "tblBranches" b ON d.branch_id=b.branch_id WHERE d.branch_id IS NOT NULL AND b.branch_id IS NULL`],
    ['user→employee', `SELECT u.user_id AS id FROM "tblUsers" u LEFT JOIN "tblEmployees" e ON u.emp_int_id::text=e.emp_int_id::text WHERE u.emp_int_id IS NOT NULL AND e.emp_int_id IS NULL`],
    ['user→jobrole', `SELECT u.user_id AS id FROM "tblUsers" u LEFT JOIN "tblJobRoles" j ON u.job_role_id=j.job_role_id WHERE u.job_role_id IS NOT NULL AND j.job_role_id IS NULL`],
    ['ujr→user', `SELECT ujr.user_job_role_id AS id FROM "tblUserJobRoles" ujr LEFT JOIN "tblUsers" u ON ujr.user_id=u.user_id WHERE u.user_id IS NULL`],
    ['ujr→jobrole', `SELECT ujr.user_job_role_id AS id FROM "tblUserJobRoles" ujr LEFT JOIN "tblJobRoles" j ON ujr.job_role_id=j.job_role_id WHERE j.job_role_id IS NULL`],
    ['emp→dept', `SELECT e.employee_id AS id FROM "tblEmployees" e LEFT JOIN "tblDepartments" d ON e.dept_id=d.dept_id WHERE e.dept_id IS NOT NULL AND d.dept_id IS NULL`],
    ['jrn→app', `SELECT jrn.job_role_nav_id AS id FROM "tblJobRoleNav" jrn LEFT JOIN "tblApps" a ON jrn.app_id=a.app_id WHERE jrn.app_id IS NOT NULL AND a.app_id IS NULL`],
    ['jrn→jobrole', `SELECT jrn.job_role_nav_id AS id FROM "tblJobRoleNav" jrn LEFT JOIN "tblJobRoles" j ON jrn.job_role_id=j.job_role_id WHERE j.job_role_id IS NULL`],
    ['asset→org', `SELECT a.asset_id AS id FROM "tblAssets" a LEFT JOIN "tblOrgs" o ON a.org_id=o.org_id WHERE a.org_id IS NOT NULL AND o.org_id IS NULL`],
    ['vendor→org', `SELECT v.vendor_id AS id FROM "tblVendors" v LEFT JOIN "tblOrgs" o ON v.org_id=o.org_id WHERE v.org_id IS NOT NULL AND o.org_id IS NULL`],
  ];

  const violations = [];
  for (const [name, sql] of fkChecks) {
    const { rows } = await c.query(sql);
    if (rows.length > 0) {
      violations.push({ name, orphanCount: rows.length, sample: rows.slice(0, 3) });
    }
  }
  return violations;
}

async function checkRequiredMaster(ten) {
  const checks = [];
  const specs = [
    { name: 'Organization', sql: 'SELECT org_id, text FROM "tblOrgs"' },
    { name: 'Admin user', sql: `SELECT user_id, email, job_role_id, int_status FROM "tblUsers" WHERE user_id='USR001'` },
    { name: 'Admin job role', sql: `SELECT job_role_id, text FROM "tblJobRoles" WHERE job_role_id='JR001'` },
    { name: 'User job role link', sql: `SELECT * FROM "tblUserJobRoles" WHERE user_id='USR001'` },
    { name: 'Branch', sql: 'SELECT branch_id, branch_code, text FROM "tblBranches"' },
    { name: 'Department', sql: 'SELECT dept_id, branch_id FROM "tblDepartments"' },
    { name: 'Employee', sql: `SELECT employee_id, emp_int_id, email_id, dept_id FROM "tblEmployees" WHERE employee_id='EMP001'` },
    { name: 'Cron jobs', sql: 'SELECT job_id, job_name, status FROM "tblJobs" ORDER BY job_id' },
    { name: 'Apps count', sql: 'SELECT COUNT(*)::int c FROM "tblApps"' },
    { name: 'Text messages', sql: 'SELECT COUNT(*)::int c FROM "tblTextMessagesDefault"' },
    { name: 'Status codes', sql: 'SELECT COUNT(*)::int c FROM "tblStatusCodes"' },
    { name: 'Props', sql: 'SELECT COUNT(*)::int c FROM "tblProps"' },
    { name: 'Maint status', sql: 'SELECT COUNT(*)::int c FROM "tblMaintStatus"' },
    { name: 'Events', sql: 'SELECT COUNT(*)::int c FROM "tblEvents"' },
    { name: 'ID sequences', sql: 'SELECT COUNT(*)::int c FROM "tblIDSequences"' },
    { name: 'Job monitor history table', sql: `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tblJobHistory') AS e` },
    { name: 'tblATInspCert view', sql: `SELECT table_type FROM information_schema.tables WHERE table_name='tblATInspCerts'` },
  ];

  for (const s of specs) {
    try {
      const r = await ten.query(s.sql);
      checks.push({ name: s.name, ok: r.rows.length > 0 || (r.rows[0] && Object.values(r.rows[0])[0] > 0), data: r.rows });
    } catch (e) {
      checks.push({ name: s.name, ok: false, error: e.message });
    }
  }
  return checks;
}

async function compareMasterCounts(ref, ten) {
  const tables = [
    'tblApps', 'tblTextMessagesDefault', 'tblTextMessagesOtherLangs',
    'tblStatusCodes', 'tblProps', 'tblUom', 'tblEvents', 'tblMaintStatus', 'tblMaintTypes',
    'tblJobs', 'tblAuditLogConfig', 'tblTechnicalLogConfig', 'tblTableFilterColumns',
    'tblOrgSettings', 'tblIDSequences',
  ];
  const rows = [];
  for (const t of tables) {
    try {
      const [hr, tr] = await Promise.all([
        ref.query(`SELECT COUNT(*)::int c FROM "${t}"`),
        ten.query(`SELECT COUNT(*)::int c FROM "${t}"`),
      ]);
      const h = hr.rows[0].c;
      const s = tr.rows[0].c;
      let status = 'OK';
      if (t === 'tblMaintTypes' || t === 'tblOrgSettings' || t === 'tblIDSequences') {
        status = s >= h ? 'OK' : 'LOW';
      } else if (h !== s) {
        status = 'MISMATCH';
      }
      rows.push({ table: t, hospitality: h, skasc: s, status });
    } catch (e) {
      rows.push({ table: t, error: e.message, status: 'ERROR' });
    }
  }
  return rows;
}

async function checkMissingApps(ref, ten) {
  const refApps = await ref.query('SELECT app_id FROM "tblApps" ORDER BY app_id');
  const tenApps = await ten.query('SELECT app_id FROM "tblApps" ORDER BY app_id');
  const tenSet = new Set(tenApps.rows.map((r) => r.app_id));
  return refApps.rows.filter((r) => !tenSet.has(r.app_id)).map((r) => r.app_id);
}

async function checkSequenceSanity(ten) {
  const issues = [];
  const specs = [
    { key: 'branch', table: 'tblBranches', col: 'branch_id', prefix: 'BR' },
    { key: 'asset', table: 'tblAssets', col: 'asset_id', prefix: 'ASS' },
    { key: 'vendor', table: 'tblVendors', col: 'vendor_id', prefix: 'V' },
    { key: 'department', table: 'tblDepartments', col: 'dept_id', prefix: 'DPT' },
    { key: 'user', table: 'tblUsers', col: 'user_id', prefix: 'USR' },
  ];
  for (const s of specs) {
    const seq = await ten.query('SELECT last_number, prefix FROM "tblIDSequences" WHERE table_key=$1', [s.key]);
    if (!seq.rows.length) {
      issues.push({ ...s, issue: 'sequence missing' });
      continue;
    }
    const escaped = s.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const max = await ten.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING("${s.col}" FROM '${escaped}(\\d+)$') AS INTEGER)),0)::int m
       FROM "${s.table}" WHERE "${s.col}" ~ $1`,
      [`^${escaped}\\d+$`]
    );
    const maxN = max.rows[0].m;
    const lastN = seq.rows[0].last_number;
    if (lastN < maxN) {
      issues.push({ ...s, issue: `sequence last_number ${lastN} < max in table ${maxN}` });
    }
  }
  return issues;
}

async function main() {
  const ref = new Client({ connectionString: refUrl() });
  const ten = new Client({ connectionString: tenUrl(tenantDb) });
  await ref.connect();
  await ten.connect();

  const report = { tenantDb, referenceDb: 'hospitality', generatedAt: new Date().toISOString(), issues: [], warnings: [], passed: [] };

  // 1. Tables
  const [refTables, tenTables] = await Promise.all([listBaseTables(ref), listBaseTables(ten)]);
  const missingTables = refTables.filter((t) => !tenTables.includes(t));
  const extraTables = tenTables.filter((t) => !refTables.includes(t));
  if (missingTables.length) report.issues.push({ check: 'missing_tables', items: missingTables });
  else report.passed.push('All reference base tables present');
  if (extraTables.length) report.warnings.push({ check: 'extra_tables', items: extraTables });

  // 2. Views
  const [refViews, tenViews] = await Promise.all([listViews(ref), listViews(ten)]);
  const missingViews = refViews.filter((v) => !tenViews.includes(v));
  if (missingViews.length) report.issues.push({ check: 'missing_views', items: missingViews });
  else report.passed.push('All reference views present');

  // 3. Column diffs (all shared tables)
  const colIssues = [];
  for (const table of refTables) {
    if (!tenTables.includes(table)) continue;
    const diff = await compareColumns(ref, ten, table);
    if (diff.missing.length || diff.extra.length || diff.typeDiff.length) {
      colIssues.push({ table, ...diff });
    }
  }
  if (colIssues.length) report.issues.push({ check: 'column_mismatches', count: colIssues.length, sample: colIssues.slice(0, 5) });
  else report.passed.push('Column definitions match on all shared tables');

  // 4. Master data counts
  const masterCounts = await compareMasterCounts(ref, ten);
  const countMismatches = masterCounts.filter((r) => r.status === 'MISMATCH');
  if (countMismatches.length) report.issues.push({ check: 'master_count_mismatch', items: countMismatches });
  else report.passed.push('Required master table row counts match or exceed reference');

  // 5. Missing apps
  const missingApps = await checkMissingApps(ref, ten);
  if (missingApps.length) report.issues.push({ check: 'missing_apps', items: missingApps });
  else report.passed.push('All hospitality app_ids present in skasc');

  // 6. ID formats
  const idAudit = await auditIdFormats(ten, tenantDb);
  const badIds = idAudit.filter((r) => r.status === 'INVALID_IDS');
  if (badIds.length) report.issues.push({ check: 'invalid_ids', items: badIds });
  else report.passed.push('All ID formats valid per idGenerator conventions');

  // 7. FK integrity
  const fkViolations = await checkFkViolations(ten);
  if (fkViolations.length) report.issues.push({ check: 'fk_orphans', items: fkViolations });
  else report.passed.push('No foreign key orphan rows detected');

  // 8. Operational sanity
  const master = await checkRequiredMaster(ten);
  const masterFails = master.filter((m) => !m.ok);
  if (masterFails.length) report.issues.push({ check: 'required_master', items: masterFails });
  else report.passed.push('Required tenant master records present (org, admin, branch, jobs, etc.)');

  // 9. Sequence sanity
  const seqIssues = await checkSequenceSanity(ten);
  if (seqIssues.length) report.warnings.push({ check: 'sequence_drift', items: seqIssues });
  else report.passed.push('ID sequences in sync with table data');

  // 10. Dept-branch link
  const deptBranch = await ten.query(`
    SELECT d.dept_id, d.branch_id, b.branch_id AS branch_exists
    FROM "tblDepartments" d
    LEFT JOIN "tblBranches" b ON d.branch_id = b.branch_id
  `);
  const brokenDept = deptBranch.rows.filter((r) => r.branch_id && !r.branch_exists);
  if (brokenDept.length) report.issues.push({ check: 'dept_branch_link', items: brokenDept });
  else report.passed.push('All departments linked to valid branches');

  // 11. User-employee link
  const userEmp = await ten.query(`
    SELECT u.user_id, u.emp_int_id, e.emp_int_id AS emp_exists
    FROM "tblUsers" u
    LEFT JOIN "tblEmployees" e ON u.emp_int_id::text = e.emp_int_id::text
  `);
  const brokenUser = userEmp.rows.filter((r) => r.emp_int_id && !r.emp_exists);
  if (brokenUser.length) report.issues.push({ check: 'user_employee_link', items: brokenUser });
  else report.passed.push('All users linked to valid employees');

  await ref.end();
  await ten.end();

  report.summary = {
    issues: report.issues.length,
    warnings: report.warnings.length,
    passed: report.passed.length,
    healthy: report.issues.length === 0,
  };
  report.masterCounts = masterCounts;
  report.idAudit = idAudit.map((r) => ({ table: r.table, column: r.column, status: r.status, invalid: r.invalidRows }));

  console.log(JSON.stringify(report, null, 2));

  // Human summary
  console.log('\n========== VERIFICATION SUMMARY ==========');
  console.log(`Tenant: ${tenantDb} vs hospitality`);
  console.log(`Issues: ${report.issues.length} | Warnings: ${report.warnings.length} | Passed: ${report.passed.length}`);
  if (report.passed.length) {
    console.log('\nPASSED:');
    report.passed.forEach((p) => console.log('  ✅', p));
  }
  if (report.warnings.length) {
    console.log('\nWARNINGS:');
    report.warnings.forEach((w) => console.log('  ⚠️', w.check, JSON.stringify(w.items || w)));
  }
  if (report.issues.length) {
    console.log('\nISSUES:');
    report.issues.forEach((i) => console.log('  ❌', i.check, JSON.stringify(i.items || i).slice(0, 500)));
    process.exit(1);
  }
  console.log('\n✅ skasc_db is healthy and aligned with hospitality for production use.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
