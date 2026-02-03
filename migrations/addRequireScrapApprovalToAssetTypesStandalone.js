/**
 * Standalone migration:
 * Adds require_scrap_approval flag to tblAssetTypes (default true)
 *
 * Run:
 *   node migrations/addRequireScrapApprovalToAssetTypesStandalone.js
 */

const { Pool } = require('pg');
require('dotenv').config();

const run = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('🔄 Adding require_scrap_approval to tblAssetTypes...');

    await pool.query(`
      ALTER TABLE "tblAssetTypes"
      ADD COLUMN IF NOT EXISTS require_scrap_approval BOOLEAN NOT NULL DEFAULT true;
    `);

    // Ensure any legacy rows are set (defensive)
    await pool.query(`
      UPDATE "tblAssetTypes"
      SET require_scrap_approval = true
      WHERE require_scrap_approval IS NULL;
    `);

    console.log('✅ Migration complete.');
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();

