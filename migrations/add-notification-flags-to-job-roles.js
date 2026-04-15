/**
 * Migration: Add notification flags to tblJobRoles
 *
 * Run:
 *   node migrations/add-notification-flags-to-job-roles.js
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding notif_warranty and notif_scrap to tblJobRoles...');
    await client.query(`
      ALTER TABLE "tblJobRoles"
      ADD COLUMN IF NOT EXISTS notif_warranty BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await client.query(`
      ALTER TABLE "tblJobRoles"
      ADD COLUMN IF NOT EXISTS notif_scrap BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await client.query('COMMIT');
    console.log('✅ tblJobRoles notification columns added/verified successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
