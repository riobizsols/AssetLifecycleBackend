require('dotenv').config();
const { Client } = require('pg');
const { getPgSslOption, getPgClientConnectTimeoutMs } = require('../utils/pgSslOption');

const pgOpts = (cs) => ({
  connectionString: cs,
  ssl: getPgSslOption(),
  connectionTimeoutMillis: getPgClientConnectTimeoutMs(),
});

async function main() {
  const reg = new Client(pgOpts(process.env.TENANT_DATABASE_URL));
  await reg.connect();
  const t = await reg.query(
    `SELECT org_id, db_name FROM tenants WHERE LOWER(subdomain) = 'gknm' OR org_id = 'GKNM'`
  );
  console.log('Tenant:', t.rows[0]);
  const row = t.rows[0];
  await reg.end();

  const tenantUrl = process.env.TENANT_DATABASE_URL.replace(/\/[^/]+$/, `/${row.db_name}`);
  const tenant = new Client(pgOpts(tenantUrl));
  await tenant.connect();
  const before = await tenant.query(
    `SELECT COUNT(*)::int AS c FROM "tblJobRoleNav" WHERE job_role_id = $1 AND int_status = 1`,
    ['JR001']
  );
  console.log('GKNM nav before:', before.rows[0].c);

  const ref = new Client(pgOpts(process.env.GENERIC_URL));
  await ref.connect();
  const refDb = await ref.query('SELECT current_database() db');
  console.log('Reference DB:', refDb.rows[0].db);
  const refCount = await ref.query(
    `SELECT COUNT(*)::int AS c FROM "tblJobRoleNav" WHERE job_role_id = $1 AND int_status = 1`,
    ['JR001']
  );
  console.log('Reference nav count:', refCount.rows[0].c);
  await ref.end();

  const { ensureJobRoleNavigation } = require('../services/tenantSetupService');
  const result = await ensureJobRoleNavigation(tenant, row.org_id);
  console.log('Sync result:', result);
  const after = await tenant.query(
    `SELECT COUNT(*)::int AS c FROM "tblJobRoleNav" WHERE job_role_id = $1 AND int_status = 1`,
    ['JR001']
  );
  console.log('GKNM nav after:', after.rows[0].c);
  await tenant.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
