#!/usr/bin/env node
require('dotenv').config();
const { Client } = require('pg');

const search = (process.argv[2] || 'pressana').toLowerCase();

(async () => {
  const registry = new Client({ connectionString: process.env.TENANT_DATABASE_URL });
  await registry.connect();
  const tenants = await registry.query(
    `SELECT org_id, subdomain, db_name
     FROM tenants
     WHERE LOWER(subdomain) LIKE $1
        OR LOWER(org_id) LIKE $1
        OR LOWER(db_name) LIKE $1`,
    [`%${search}%`]
  );
  console.log('Tenants:', JSON.stringify(tenants.rows, null, 2));
  await registry.end();

  if (!tenants.rows.length) process.exit(0);

  const baseUrl = process.env.DATABASE_URL;
  const hostMatch = baseUrl.match(/@([^:]+):(\d+)\//);
  if (!hostMatch) throw new Error('Could not parse DATABASE_URL host');

  for (const tenant of tenants.rows) {
    const dbName = tenant.db_name;
    const tenantUrl = baseUrl.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
    const client = new Client({ connectionString: tenantUrl });
    await client.connect();

    const nav = await client.query(
      `SELECT job_role_nav_id, parent_id, app_id, label, sequence, access_level
       FROM "tblJobRoleNav"
       WHERE job_role_id = 'JR001'
         AND int_status = 1
         AND (app_id = 'REOPENEDBREAKDOWNS'
           OR LOWER(label) = 'reports'
           OR parent_id IN (
             SELECT job_role_nav_id FROM "tblJobRoleNav"
             WHERE job_role_id = 'JR001' AND int_status = 1 AND LOWER(label) = 'reports' AND is_group = true
           ))
       ORDER BY sequence`
    );
    console.log(`\nNav in ${dbName}:`, JSON.stringify(nav.rows, null, 2));

    const apps = await client.query(
      `SELECT app_id, text FROM "tblApps" WHERE app_id = 'REOPENEDBREAKDOWNS'`
    );
    console.log('App row:', JSON.stringify(apps.rows, null, 2));

    await client.end();
  }

  process.exit(0);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
