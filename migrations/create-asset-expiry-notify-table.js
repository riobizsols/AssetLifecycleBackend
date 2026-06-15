/**
 * Migration: Create tblAssetExpiryNotify
 *
 * Run:
 *   node migrations/create-asset-expiry-notify-table.js
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

    console.log('Creating tblAssetExpiryNotify (if not present)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblAssetExpiryNotify" (
        notify_id       VARCHAR(50) PRIMARY KEY,
        notif_group_id  VARCHAR(50),
        asset_id        VARCHAR(50) NOT NULL,
        org_id          VARCHAR(50) NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'UNREAD',
        title           VARCHAR(255),
        body            TEXT,
        last_seen_on    TIMESTAMPTZ,
        snooze_days     INTEGER NOT NULL DEFAULT 0,
        emp_int_id      VARCHAR(50),
        created_on      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_asset_id
      ON "tblAssetExpiryNotify" (asset_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_org_id
      ON "tblAssetExpiryNotify" (org_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_emp_int_id
      ON "tblAssetExpiryNotify" (emp_int_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_status
      ON "tblAssetExpiryNotify" (status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_created_on
      ON "tblAssetExpiryNotify" (created_on DESC);
    `);

    await client.query('COMMIT');
    console.log('✅ tblAssetExpiryNotify created/verified successfully.');
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
