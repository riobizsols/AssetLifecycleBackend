/**
 * Create tenant_user_emails table in the tenant registry database.
 * Usage: node scripts/create-tenant-user-emails-table.js
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { pgSslOptions } = require('../utils/pgSsl');

async function main() {
  const connectionString = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('TENANT_DATABASE_URL or DATABASE_URL is required');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: pgSslOptions(connectionString),
    connectionTimeoutMillis: 15000,
  });

  try {
    await client.connect();
    const sqlPath = path.join(__dirname, '../migrations/create_tenant_user_emails_table.sql');
    let sql;
    try {
      sql = fs.readFileSync(sqlPath, 'utf8');
    } catch {
      sql = `
CREATE TABLE IF NOT EXISTS "tenant_user_emails" (
    email_normalized character varying(320) PRIMARY KEY,
    email_display character varying(320) NOT NULL,
    org_id character varying(10) NOT NULL,
    subdomain character varying(63) NOT NULL,
    user_id character varying(50),
    employee_id character varying(50),
    source character varying(64) NOT NULL DEFAULT 'unknown',
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tenant_user_emails_org_id ON "tenant_user_emails"(org_id);
CREATE INDEX IF NOT EXISTS idx_tenant_user_emails_subdomain ON "tenant_user_emails"(subdomain);
`;
    }
    await client.query(sql);
    const check = await client.query(`
      SELECT COUNT(*)::int AS n FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tenant_user_emails'
    `);
    console.log(check.rows[0].n ? 'tenant_user_emails table ready' : 'table verification failed');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
