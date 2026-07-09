/** Re-run orphan group cleanup. Usage: node scripts/clean-orphan-nav-groups.js [db_name|--all-tenants] */
require("dotenv").config();
const { Pool, Client } = require("pg");

async function getDbUrls() {
  if (process.argv[2] && process.argv[2] !== "--all-tenants") {
    const base = process.env.DATABASE_URL.replace(/\/[^/]+$/, "");
    return [{ label: process.argv[2], url: `${base}/${process.argv[2]}` }];
  }
  const urls = [{ label: "hospitality", url: process.env.DATABASE_URL }];
  const registryUrl =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL.replace(/\/[^/]+$/, "/postgres");
  const client = new Client({ connectionString: registryUrl });
  await client.connect();
  const { rows } = await client.query(
    `SELECT org_id, db_name, subdomain FROM "tenants" WHERE is_active = true AND db_name IS NOT NULL`,
  );
  await client.end();
  const base = registryUrl.replace(/\/[^/]+$/, "");
  for (const row of rows) {
    urls.push({ label: `${row.org_id}`, url: `${base}/${row.db_name}` });
  }
  return urls;
}

async function clean(url, label) {
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
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
    console.log(`${label}: removed ${result.rowCount}`, result.rows.map((r) => r.job_role_nav_id).join(", ") || "(none)");
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const targets = await getDbUrls();
  for (const t of targets) {
    try {
      await clean(t.url, t.label);
    } catch (e) {
      console.error(`${t.label}: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
