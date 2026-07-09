/**
 * Audit databases for issues after navigation group model migration.
 * Usage: node scripts/audit-nav-group-db-changes.js [--all-tenants]
 */
require("dotenv").config();
const { Pool, Client } = require("pg");

const LEGACY_GROUP_APP_IDS = [
  "MASTERDATA",
  "REPORTS",
  "ADMINSETTINGS",
  "ASSETASSIGNMENT",
  "INSPECTION",
];

async function getTargets(runAllTenants) {
  const targets = [
    {
      label: "hospitality",
      url: process.env.DATABASE_URL,
    },
  ];

  if (!runAllTenants) return targets.filter((t) => t.url);

  const registryUrl =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL.replace(/\/[^/]+$/, "/postgres");
  const client = new Client({ connectionString: registryUrl });
  await client.connect();
  const { rows } = await client.query(`
    SELECT org_id, db_name, subdomain
    FROM "tenants"
    WHERE is_active = true AND db_name IS NOT NULL
    ORDER BY org_id
  `);
  await client.end();

  const baseUrl = registryUrl.replace(/\/[^/]+$/, "");
  for (const row of rows) {
    targets.push({
      label: `${row.org_id} (${row.subdomain})`,
      url: `${baseUrl}/${row.db_name}`,
    });
  }
  return targets;
}

async function auditDatabase(label, connectionString) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 15000 });
  const client = await pool.connect();
  const issues = [];

  try {
    const nullable = await client.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tblJobRoleNav'
        AND column_name = 'app_id'
    `);

    if (nullable.rows[0]?.is_nullable !== "YES") {
      issues.push({
        severity: "high",
        code: "APP_ID_NOT_NULLABLE",
        detail: "tblJobRoleNav.app_id is still NOT NULL",
      });
    }

    const legacyApps = await client.query(
      `SELECT app_id, text FROM "tblApps" WHERE UPPER(app_id) = ANY($1::text[]) ORDER BY app_id`,
      [LEGACY_GROUP_APP_IDS],
    );
    if (legacyApps.rows.length > 0) {
      issues.push({
        severity: "medium",
        code: "LEGACY_GROUP_APPS_REMAIN",
        detail: `tblApps still has group-only apps: ${legacyApps.rows.map((r) => r.app_id).join(", ")}`,
        rows: legacyApps.rows,
      });
    }

    const groupsWithApp = await client.query(`
      SELECT job_role_nav_id, label, app_id, parent_id, job_role_id
      FROM "tblJobRoleNav"
      WHERE is_group = true AND app_id IS NOT NULL
      ORDER BY label
      LIMIT 50
    `);
    if (groupsWithApp.rows.length > 0) {
      issues.push({
        severity: "medium",
        code: "GROUPS_WITH_APP_ID",
        detail: `${groupsWithApp.rows.length}+ group row(s) still have app_id set`,
        rows: groupsWithApp.rows,
      });
    }

    const screensMarkedGroup = await client.query(`
      SELECT p.job_role_nav_id, p.label, p.app_id, p.is_group, p.parent_id
      FROM "tblJobRoleNav" p
      WHERE p.is_group = true
        AND p.app_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tblJobRoleNav" c
          WHERE c.parent_id = p.job_role_nav_id
        )
      ORDER BY p.label
      LIMIT 50
    `);
    if (screensMarkedGroup.rows.length > 0) {
      issues.push({
        severity: "high",
        code: "EMPTY_GROUPS_NO_CHILDREN",
        detail: `${screensMarkedGroup.rows.length} empty group row(s) — may render as broken nav links`,
        rows: screensMarkedGroup.rows,
      });
    }

    const submenuMissingApp = await client.query(`
      SELECT job_role_nav_id, label, app_id, parent_id, is_group
      FROM "tblJobRoleNav"
      WHERE is_group = false AND (app_id IS NULL OR TRIM(app_id) = '')
      ORDER BY label
      LIMIT 50
    `);
    if (submenuMissingApp.rows.length > 0) {
      issues.push({
        severity: "high",
        code: "SCREEN_ROWS_MISSING_APP_ID",
        detail: `${submenuMissingApp.rows.length}+ non-group nav row(s) missing app_id`,
        rows: submenuMissingApp.rows,
      });
    }

    const navMissingApps = await client.query(`
      SELECT DISTINCT n.app_id
      FROM "tblJobRoleNav" n
      LEFT JOIN "tblApps" a ON a.app_id = n.app_id
      WHERE n.is_group = false
        AND n.app_id IS NOT NULL
        AND a.app_id IS NULL
      ORDER BY n.app_id
      LIMIT 50
    `);
    if (navMissingApps.rows.length > 0) {
      issues.push({
        severity: "high",
        code: "NAV_APP_ID_NOT_IN_TBLAPPS",
        detail: `Screen app_ids in nav but missing from tblApps: ${navMissingApps.rows.map((r) => r.app_id).join(", ")}`,
        rows: navMissingApps.rows,
      });
    }

    const orphanParents = await client.query(`
      SELECT n.job_role_nav_id, n.label, n.parent_id
      FROM "tblJobRoleNav" n
      WHERE n.parent_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tblJobRoleNav" p
          WHERE p.job_role_nav_id = n.parent_id
        )
      ORDER BY n.label
      LIMIT 30
    `);
    if (orphanParents.rows.length > 0) {
      issues.push({
        severity: "medium",
        code: "ORPHAN_PARENT_ID",
        detail: `${orphanParents.rows.length}+ nav row(s) reference missing parent`,
        rows: orphanParents.rows,
      });
    }

    const dupLabels = await client.query(`
      SELECT label, job_role_id, parent_id, COUNT(*)::int AS cnt
      FROM "tblJobRoleNav"
      GROUP BY label, job_role_id, parent_id
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC, label
      LIMIT 20
    `);
    if (dupLabels.rows.length > 0) {
      issues.push({
        severity: "low",
        code: "DUPLICATE_NAV_LABELS",
        detail: `${dupLabels.rows.length} duplicate label groups in same role/parent`,
        rows: dupLabels.rows,
      });
    }

    const jobMonitorBad = await client.query(`
      SELECT job_role_nav_id, label, app_id, is_group, parent_id
      FROM "tblJobRoleNav"
      WHERE label ILIKE 'Job Monitor'
        AND (is_group = true OR app_id IS DISTINCT FROM 'JOBMONITOR')
    `);
    if (jobMonitorBad.rows.length > 0) {
      issues.push({
        severity: "high",
        code: "JOB_MONITOR_BAD",
        detail: "Job Monitor rows still misconfigured",
        rows: jobMonitorBad.rows,
      });
    }

    const fk = await client.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'tblJobRoleNav'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'app_id'
    `);
    if (fk.rows.length > 0) {
      issues.push({
        severity: "medium",
        code: "APP_ID_FK_REMAINS",
        detail: `FK still on tblJobRoleNav.app_id: ${fk.rows.map((r) => r.constraint_name).join(", ")}`,
      });
    }

    return { label, ok: issues.length === 0, issues };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const runAllTenants = process.argv.includes("--all-tenants");
  const targets = await getTargets(runAllTenants);

  const allResults = [];
  for (const target of targets) {
    try {
      const result = await auditDatabase(target.label, target.url);
      allResults.push(result);
    } catch (err) {
      allResults.push({
        label: target.label,
        ok: false,
        issues: [
          {
            severity: "high",
            code: "DB_UNREACHABLE",
            detail: err.message,
          },
        ],
      });
    }
  }

  let totalIssues = 0;
  for (const result of allResults) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(result.label);
    console.log("=".repeat(60));
    if (result.ok) {
      console.log("✅ No issues found");
      continue;
    }
    for (const issue of result.issues) {
      totalIssues++;
      console.log(`[${issue.severity.toUpperCase()}] ${issue.code}: ${issue.detail}`);
      if (issue.rows?.length) {
        for (const row of issue.rows.slice(0, 5)) {
          console.log("   ", JSON.stringify(row));
        }
        if (issue.rows.length > 5) {
          console.log(`    ... and ${issue.rows.length - 5} more`);
        }
      }
    }
  }

  console.log(`\n=== Audit complete: ${totalIssues} issue(s) across ${allResults.length} database(s) ===`);
  process.exit(totalIssues > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
