/**
 * Fix Job Monitor nav rows wrongly stored as groups (app_id cleared by group migration).
 *
 * Usage:
 *   node scripts/fix-job-monitor-nav-rows.js                    # DATABASE_URL (hospitality)
 *   node scripts/fix-job-monitor-nav-rows.js --all-tenants        # hospitality + all tenant DBs
 *   TARGET_DATABASE_URL=postgresql://... node scripts/fix-job-monitor-nav-rows.js
 */
require("dotenv").config();
const { Pool, Client } = require("pg");

async function fixJobMonitorRows(connectionString, label) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log(`\n--- ${label} ---`);

    const { rows } = await client.query(`
      SELECT job_role_nav_id, org_id, job_role_id, parent_id, app_id, label, is_group, sequence
      FROM "tblJobRoleNav"
      WHERE label ILIKE 'Job Monitor'
      ORDER BY job_role_nav_id
    `);

    const broken = rows.filter((r) => r.is_group || !r.app_id);
    console.log(`Found ${rows.length} Job Monitor row(s), ${broken.length} need fix`);

    if (broken.length === 0 && rows.length <= 1) {
      console.log("Nothing to fix");
      return { fixed: 0, deleted: 0 };
    }

    await client.query("BEGIN");

    const keeper = rows[0];
    const duplicateIds = rows.slice(1).map((r) => r.job_role_nav_id);

    if (broken.length > 0 || keeper.app_id !== "JOBMONITOR") {
      await client.query(
        `
          UPDATE "tblJobRoleNav"
          SET is_group = false,
              app_id = 'JOBMONITOR',
              label = 'Job Monitor'
          WHERE job_role_nav_id = $1
        `,
        [keeper.job_role_nav_id],
      );
      console.log(`✓ Fixed ${keeper.job_role_nav_id} → is_group=false, app_id=JOBMONITOR`);
    }

    let deletedCount = 0;
    if (duplicateIds.length > 0) {
      const deleted = await client.query(
        `DELETE FROM "tblJobRoleNav" WHERE job_role_nav_id = ANY($1) RETURNING job_role_nav_id`,
        [duplicateIds],
      );
      deletedCount = deleted.rowCount;
      console.log(`✓ Removed ${deletedCount} duplicate Job Monitor row(s)`);
    }

    const orgRow = await client.query(
      `SELECT org_id FROM "tblOrgs" ORDER BY org_id LIMIT 1`,
    );
    const orgId = keeper.org_id || orgRow.rows[0]?.org_id || "ORG001";

    await client.query(
      `
        INSERT INTO "tblApps" (app_id, text, int_status, org_id)
        VALUES ('JOBMONITOR', 'Job Monitor', true, $1)
        ON CONFLICT (app_id) DO UPDATE
        SET text = EXCLUDED.text, int_status = EXCLUDED.int_status
      `,
      [orgId],
    );
    console.log("✓ Ensured JOBMONITOR exists in tblApps");

    await client.query("COMMIT");
    console.log(`✅ ${label}: Job Monitor nav rows fixed`);
    return { fixed: 1, deleted: deletedCount };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function getTenantDatabaseUrls() {
  const registryUrl =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL.replace(/\/[^/]+$/, "/postgres");
  const client = new Client({
    connectionString: registryUrl,
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  const { rows } = await client.query(`
    SELECT org_id, db_name, subdomain, is_active
    FROM "tenants"
    WHERE is_active = true AND db_name IS NOT NULL
    ORDER BY org_id
  `);
  await client.end();

  const baseUrl = registryUrl.replace(/\/[^/]+$/, "");
  return rows.map((row) => ({
    orgId: row.org_id,
    subdomain: row.subdomain,
    url: `${baseUrl}/${row.db_name}`,
  }));
}

async function main() {
  const runAllTenants = process.argv.includes("--all-tenants");
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

  if (!targetUrl && !runAllTenants) {
    console.error("❌ DATABASE_URL or TARGET_DATABASE_URL required");
    process.exit(1);
  }

  const results = [];

  if (targetUrl) {
    results.push(await fixJobMonitorRows(targetUrl, "hospitality (DATABASE_URL)"));
  }

  if (runAllTenants) {
    const tenants = await getTenantDatabaseUrls();
    console.log(`\nFound ${tenants.length} active tenant database(s)`);
    for (const tenant of tenants) {
      try {
        results.push(
          await fixJobMonitorRows(
            tenant.url,
            `${tenant.orgId} (${tenant.subdomain})`,
          ),
        );
      } catch (err) {
        console.error(`❌ ${tenant.orgId}: ${err.message}`);
        results.push({ fixed: 0, deleted: 0, error: err.message });
      }
    }
  }

  console.log("\n=== Summary ===");
  for (const r of results) {
    if (r.error) console.log(`  error: ${r.error}`);
    else console.log(`  fixed=${r.fixed}, deleted=${r.deleted}`);
  }
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
