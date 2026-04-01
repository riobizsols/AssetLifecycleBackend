/**
 * Migration: Create tblAssetMaintSch_BR_Hist
 * Tracks breakdown history for maintenance schedules (reopen/status timeline).
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
    console.log('Creating tblAssetMaintSch_BR_Hist (if not present)...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblAssetMaintSch_BR_Hist" (
        amsbr_id    TEXT PRIMARY KEY,
        ams_id      TEXT NOT NULL,
        status      VARCHAR(20) NOT NULL,
        created_on  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by  TEXT NOT NULL,
        notes       TEXT,
        CONSTRAINT fk_tblAssetMaintSch_BR_Hist_ams_id
          FOREIGN KEY (ams_id)
          REFERENCES "tblAssetMaintSch"(ams_id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetMaintSch_BR_Hist_ams_id
        ON "tblAssetMaintSch_BR_Hist" (ams_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetMaintSch_BR_Hist_status
        ON "tblAssetMaintSch_BR_Hist" (status);
    `);

    console.log('✅ tblAssetMaintSch_BR_Hist: created or already exists');
    console.log('Migration completed.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

