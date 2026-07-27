/**
 * Menu groups use is_group=true with app_id=NULL.
 * Some older tenant DBs have app_id NOT NULL on tblJobRoleNav, which breaks POST /job-role-navigation.
 *
 * Usage (single DB):
 *   DATABASE_URL=postgresql://.../pressana_db node migrations/alter-job-role-nav-app-id-nullable.js
 *
 * Usage (all active tenants from registry):
 *   TENANT_DATABASE_URL=postgresql://.../postgres node migrations/alter-job-role-nav-app-id-nullable.js --all-tenants
 */

const { Client } = require('pg');

async function alterJobRoleNavAppIdNullable(client) {
  const check = await client.query(`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tblJobRoleNav'
      AND column_name = 'app_id'
  `);

  if (!check.rows.length) {
    console.log('tblJobRoleNav.app_id not found — skipping');
    return { skipped: true };
  }

  if (check.rows[0].is_nullable === 'YES') {
    console.log('tblJobRoleNav.app_id already nullable — OK');
    return { skipped: true };
  }

  await client.query('ALTER TABLE "tblJobRoleNav" ALTER COLUMN app_id DROP NOT NULL');
  console.log('Altered tblJobRoleNav.app_id → nullable');
  return { altered: true };
}

async function syncJobRoleNavSequence(client) {
  await client.query(`
    INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
    SELECT
      'jobrolenav',
      'JRN',
      COALESCE(MAX(
        CASE
          WHEN job_role_nav_id ~ '^JRN[0-9]+$'
          THEN CAST(SUBSTRING(job_role_nav_id FROM 4) AS INTEGER)
          ELSE 0
        END
      ), 0)
    FROM "tblJobRoleNav"
    ON CONFLICT (table_key) DO UPDATE
    SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
  `);
  await client.query(`DELETE FROM "tblIDSequences" WHERE table_key = 'job_role_nav'`);
  console.log('Synced jobrolenav sequence; removed duplicate job_role_nav key');
}

async function runOnDatabase(connectionString, label) {
  const client = new Client({
    connectionString,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  try {
    console.log(`\n=== ${label} ===`);
    await alterJobRoleNavAppIdNullable(client);
    await syncJobRoleNavSequence(client);
  } finally {
    await client.end();
  }
}

async function main() {
  const allTenants = process.argv.includes('--all-tenants');
  const registryUrl = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  const targetUrl = process.env.DATABASE_URL;

  if (allTenants) {
    if (!registryUrl) {
      throw new Error('Set TENANT_DATABASE_URL or DATABASE_URL for --all-tenants');
    }
    const registry = new Client({
      connectionString: registryUrl,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
    await registry.connect();
    const { rows } = await registry.query(`
      SELECT org_id, subdomain, db_name, db_host, db_port, db_user, db_password
      FROM tenants
      ORDER BY subdomain
    `);
    await registry.end();

    for (const t of rows) {
      const host = t.db_host || 'localhost';
      const port = t.db_port || 5432;
      const user = t.db_user || 'postgres';
      const password = encodeURIComponent(t.db_password || process.env.PGPASSWORD || '');
      const url = `postgresql://${user}:${password}@${host}:${port}/${t.db_name}?sslmode=disable`;
      await runOnDatabase(url, `${t.subdomain} (${t.db_name})`);
    }
    return;
  }

  if (!targetUrl) {
    throw new Error('Set DATABASE_URL to the tenant database (or use --all-tenants)');
  }
  await runOnDatabase(targetUrl, targetUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
