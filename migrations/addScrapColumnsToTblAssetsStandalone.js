/**
 * Standalone migration:
 * Adds scrap metadata columns to tblAssets:
 *  - scrap_notes
 *  - scraped_on
 *  - scraped_by
 *
 * Run:
 *   node migrations/addScrapColumnsToTblAssetsStandalone.js
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
    console.log('🔄 Adding scrap metadata columns to tblAssets...');

    await pool.query(`
      ALTER TABLE "tblAssets"
      ADD COLUMN IF NOT EXISTS scrap_notes TEXT;
    `);

    await pool.query(`
      ALTER TABLE "tblAssets"
      ADD COLUMN IF NOT EXISTS scraped_on TIMESTAMP;
    `);

    await pool.query(`
      ALTER TABLE "tblAssets"
      ADD COLUMN IF NOT EXISTS scraped_by VARCHAR(50);
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

