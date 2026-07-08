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
    await client.query(fs.readFileSync(sqlPath, 'utf8'));
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
