/**
 * Register hospitality database as a tenant and backfill tenant_user_emails.
 * Usage: node scripts/register-hospitality-tenant.js [--subdomain hospitality]
 */
require('dotenv').config();
const { Pool } = require('pg');
const { buildPoolConfig } = require('../utils/pgSsl');
const { registerTenant } = require('../services/tenantService');

const SUBDOMAIN = (() => {
  const idx = process.argv.indexOf('--subdomain');
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1].toLowerCase() : 'hospitality';
})();

const ORG_ID = 'ORG001';

function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) throw new Error('Invalid DATABASE_URL format');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5].split('?')[0],
  };
}

function normalizeEmail(email) {
  let value = String(email || '').trim();
  if (!value) return '';
  if (value.toLowerCase().startsWith('mailto:')) value = value.slice(7).trim();
  return value.toLowerCase();
}

function displayEmail(email) {
  let value = String(email || '').trim();
  if (value.toLowerCase().startsWith('mailto:')) value = value.slice(7).trim();
  return value;
}

async function backfillEmails(registryPool, hospitalityPool) {
  const users = await hospitalityPool.query(`
    SELECT user_id, email, org_id, emp_int_id
    FROM "tblUsers"
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    ORDER BY user_id
  `);

  let inserted = 0;
  let skippedExisting = 0;
  let skipped = 0;

  for (const user of users.rows) {
    const emailNormalized = normalizeEmail(user.email);
    const emailDisplay = displayEmail(user.email);

    if (!emailNormalized || !emailNormalized.includes('@')) {
      skipped += 1;
      continue;
    }

    const result = await registryPool.query(
      `INSERT INTO tenant_user_emails (
         email_normalized, email_display, org_id, subdomain, user_id, employee_id, source
       ) VALUES ($1, $2, $3, $4, $5, $6, 'backfill_hospitality')
       ON CONFLICT (email_normalized) DO NOTHING
       RETURNING email_normalized`,
      [
        emailNormalized,
        emailDisplay,
        user.org_id,
        SUBDOMAIN,
        user.user_id,
        user.emp_int_id || null,
      ]
    );

    if (result.rowCount) inserted += 1;
    else skippedExisting += 1;
  }

  return { total: users.rows.length, inserted, skippedExisting, skipped };
}

async function main() {
  const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);

  if (dbConfig.database !== 'hospitality') {
    console.warn(`Warning: DATABASE_URL database is "${dbConfig.database}", expected hospitality`);
  }

  console.log(`Registering tenant ORG001 -> ${dbConfig.database} (subdomain: ${SUBDOMAIN})...`);
  await registerTenant(ORG_ID, {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    subdomain: SUBDOMAIN,
  });
  console.log('tenants row upserted.');

  const registryPool = new Pool(buildPoolConfig(process.env.TENANT_DATABASE_URL, { connectionTimeoutMillis: 15000 }));
  const hospitalityPool = new Pool(buildPoolConfig(process.env.DATABASE_URL, { connectionTimeoutMillis: 15000 }));

  const emailStats = await backfillEmails(registryPool, hospitalityPool);
  console.log('tenant_user_emails backfill:', emailStats);

  const verify = await registryPool.query(
    `SELECT org_id, subdomain, db_name, is_active FROM tenants WHERE org_id = $1`,
    [ORG_ID]
  );
  const emailCount = await registryPool.query(
    `SELECT COUNT(*)::int AS count FROM tenant_user_emails WHERE subdomain = $1`,
    [SUBDOMAIN]
  );

  console.log('\nVerification:');
  console.log('tenants:', verify.rows[0]);
  console.log(`tenant_user_emails for subdomain "${SUBDOMAIN}":`, emailCount.rows[0].count);

  await registryPool.end();
  await hospitalityPool.end();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
