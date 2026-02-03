/**
 * Standalone migration:
 * Drops the foreign key constraint fk_wf_scrap_h_assetgroup from tblWFScrap_H.assetgroup_id
 * This allows using internal group IDs (like SCRAP_INDIVIDUAL_*) that don't exist in tblAssetGroup_H
 *
 * Run:
 *   node migrations/dropWFScrapHAssetGroupFKStandalone.js
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
    console.log('🔄 Dropping foreign key constraint fk_wf_scrap_h_assetgroup from tblWFScrap_H...');

    // Check if constraint exists
    const checkConstraint = await pool.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'tblWFScrap_H'
        AND constraint_name = 'fk_wf_scrap_h_assetgroup'
    `);

    if (checkConstraint.rows.length === 0) {
      console.log('⚠️  Constraint fk_wf_scrap_h_assetgroup does not exist. Skipping...');
      return;
    }

    // Drop the foreign key constraint
    await pool.query(`
      ALTER TABLE "tblWFScrap_H"
      DROP CONSTRAINT IF EXISTS fk_wf_scrap_h_assetgroup;
    `);

    console.log('✅ Foreign key constraint dropped successfully.');
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    console.error(e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
