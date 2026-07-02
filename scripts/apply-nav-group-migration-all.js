/**
 * Apply navigation group model to hospitality + all active tenant DBs.
 * - Nullable app_id, drop FK, clear group app_ids, remove legacy group apps
 * - Fix Job Monitor rows
 * - Remove orphan empty/duplicate group nav rows
 *
 * Usage: node scripts/apply-nav-group-migration-all.js
 */
require("dotenv").config();
const { Pool, Client } = require("pg");
const { applyNavigationGroupModel } = require("../utils/navigationGroupUtils");

async function dropJobRoleNavAppFk(client) {
  const { rows } = await client.query(`
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

  for (const { constraint_name } of rows) {
    await client.query(
      `ALTER TABLE "tblJobRoleNav" DROP CONSTRAINT IF EXISTS "${constraint_name}"`,
    );
  }
  return rows.length;
}

async function fixJobMonitor(client) {
  const { rows } = await client.query(`
    SELECT job_role_nav_id, org_id
    FROM "tblJobRoleNav"
    WHERE label ILIKE 'Job Monitor'
    ORDER BY job_role_nav_id
  `);

  if (rows.length === 0) return { fixed: 0, deleted: 0 };

  const keeper = rows[0].job_role_nav_id;
  const duplicateIds = rows.slice(1).map((r) => r.job_role_nav_id);

  await client.query(
    `
      UPDATE "tblJobRoleNav"
      SET is_group = false, app_id = 'JOBMONITOR', label = 'Job Monitor'
      WHERE job_role_nav_id = $1
    `,
    [keeper],
  );

  let deleted = 0;
  if (duplicateIds.length > 0) {
    const del = await client.query(
      `DELETE FROM "tblJobRoleNav" WHERE job_role_nav_id = ANY($1)`,
      [duplicateIds],
    );
    deleted = del.rowCount;
  }

  const orgRow = await client.query(`SELECT org_id FROM "tblOrgs" ORDER BY org_id LIMIT 1`);
  const orgId = rows[0].org_id || orgRow.rows[0]?.org_id || "ORG001";

  await client.query(
    `
      INSERT INTO "tblApps" (app_id, text, int_status, org_id)
      VALUES ('JOBMONITOR', 'Job Monitor', true, $1)
      ON CONFLICT (app_id) DO UPDATE SET text = EXCLUDED.text, int_status = EXCLUDED.int_status
    `,
    [orgId],
  );

  return { fixed: 1, deleted };
}

async function cleanOrphanGroups(client) {
  const result = await client.query(`
    DELETE FROM "tblJobRoleNav" p
    WHERE p.is_group = true
      AND NOT EXISTS (
        SELECT 1 FROM "tblJobRoleNav" c WHERE c.parent_id = p.job_role_nav_id
      )
      AND (
        TRIM(COALESCE(p.label, '')) = ''
        OR EXISTS (
          SELECT 1 FROM "tblJobRoleNav" o
          WHERE o.job_role_id = p.job_role_id
            AND COALESCE(o.parent_id, '') = COALESCE(p.parent_id, '')
            AND o.label = p.label
            AND o.job_role_nav_id <> p.job_role_nav_id
            AND (
              EXISTS (SELECT 1 FROM "tblJobRoleNav" c2 WHERE c2.parent_id = o.job_role_nav_id)
              OR (o.is_group = false AND o.app_id IS NOT NULL)
            )
        )
        OR EXISTS (
          SELECT 1 FROM "tblJobRoleNav" screen
          WHERE screen.job_role_id = p.job_role_id
            AND screen.is_group = false
            AND screen.app_id IS NOT NULL
            AND LOWER(TRIM(screen.label)) = LOWER(TRIM(p.label))
        )
        OR (
          LOWER(TRIM(p.label)) = 'maintenance supervisor'
          AND EXISTS (
            SELECT 1 FROM "tblJobRoleNav" s
            WHERE s.job_role_id = p.job_role_id
              AND s.app_id = 'SUPERVISORAPPROVAL'
          )
        )
      )
    RETURNING job_role_nav_id, label
  `);
  return result.rowCount;
}

async function migrateDatabase(label, connectionString) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 15000 });
  const client = await pool.connect();

  try {
    console.log(`\n--- ${label} ---`);
    await client.query("BEGIN");

    const fksDropped = await dropJobRoleNavAppFk(client);
    if (fksDropped > 0) {
      console.log(`✓ Dropped ${fksDropped} FK(s) on tblJobRoleNav.app_id`);
    }

    await client.query(`ALTER TABLE "tblJobRoleNav" ALTER COLUMN app_id DROP NOT NULL`);
    const navResult = await applyNavigationGroupModel(client, label);
    const jobMonitor = await fixJobMonitor(client);
    const orphansRemoved = await cleanOrphanGroups(client);

    await client.query("COMMIT");
    console.log(
      `✅ nav=${navResult.navUpdated} appsRemoved=${navResult.appsRemoved} jobMonitor=${jobMonitor.fixed}/${jobMonitor.deleted} orphans=${orphansRemoved}`,
    );
    return { ok: true, navResult, jobMonitor, orphansRemoved };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function getTargets() {
  const targets = [{ label: "hospitality", url: process.env.DATABASE_URL }];

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

async function main() {
  const targets = await getTargets();
  const results = [];

  for (const target of targets) {
    try {
      results.push({ label: target.label, ...(await migrateDatabase(target.label, target.url)) });
    } catch (err) {
      console.error(`❌ ${target.label}: ${err.message}`);
      results.push({ label: target.label, ok: false, error: err.message });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => r.error);
  console.log(`\n=== Done: ${ok}/${results.length} succeeded, ${failed.length} failed ===`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  - ${f.label}: ${f.error}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
