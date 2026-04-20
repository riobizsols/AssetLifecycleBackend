/**
 * Migration: Create tblAssetWarrantyNotify
 *
 * Run:
 *   node migrations/create-asset-warranty-notify-table.js
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

    console.log('Creating tblAssetWarrantyNotify (if not present)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblAssetWarrantyNotify" (
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
      CREATE INDEX IF NOT EXISTS idx_tblAssetWarrantyNotify_asset_id
      ON "tblAssetWarrantyNotify" (asset_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetWarrantyNotify_org_id
      ON "tblAssetWarrantyNotify" (org_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetWarrantyNotify_emp_int_id
      ON "tblAssetWarrantyNotify" (emp_int_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetWarrantyNotify_status
      ON "tblAssetWarrantyNotify" (status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetWarrantyNotify_created_on
      ON "tblAssetWarrantyNotify" (created_on DESC);
    `);

    await client.query('COMMIT');
    console.log('✅ tblAssetWarrantyNotify created/verified successfully.');
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
