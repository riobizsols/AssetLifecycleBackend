/**
 * Migration: Create tblScrapAssetHist for scrap workflow audit history
 *
 * Run:
 *   node migrations/create-tblScrapAssetHist.js
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

    console.log('Creating "tblScrapAssetHist" (if not present)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblScrapAssetHist" (
        scraphis_id   VARCHAR(20)  PRIMARY KEY,
        wfscrap_h_id  VARCHAR(50),
        wfscrap_d_id  VARCHAR(50),
        asset_id      VARCHAR(20),
        action_by     VARCHAR(20)  NOT NULL,
        action_on     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        action        VARCHAR(30)  NOT NULL,
        notes         TEXT,
        org_id        VARCHAR(20)  NOT NULL,
        created_by    VARCHAR(50),
        created_on    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        scrap_type    VARCHAR(50),
        ssh_id        VARCHAR(20)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblScrapAssetHist_wfscrap_h_id
      ON "tblScrapAssetHist"(wfscrap_h_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblScrapAssetHist_org_id
      ON "tblScrapAssetHist"(org_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblScrapAssetHist_asset_id
      ON "tblScrapAssetHist"(asset_id);
    `);

    await client.query(`
      INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
      SELECT 'scrap_asset_hist', 'SCRAP', 0
      WHERE NOT EXISTS (
        SELECT 1 FROM "tblIDSequences" WHERE table_key = 'scrap_asset_hist'
      );
    `);

    await client.query('COMMIT');
    console.log('✅ tblScrapAssetHist created/verified successfully.');
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
