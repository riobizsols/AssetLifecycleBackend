/**
 * Standalone migration:
 * Fixes foreign key constraint issue on tblAssetScrap.asset_group_id
 * 
 * Problem: Internal group IDs (SCRAP_SALES_*, INDIVIDUAL_ASSET_*) don't exist in tblAssetGroup_H
 * Solution: Drop the foreign key constraint and make asset_group_id nullable
 *
 * Run:
 *   node migrations/fixAssetScrapGroupFKStandalone.js
 */
const { Pool } = require("pg");
require("dotenv").config();

const run = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log("🔄 Fixing tblAssetScrap foreign key constraint...");

    await pool.query('BEGIN');

    // Check if constraint exists
    const constraintCheck = await pool.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'tblAssetScrap'
        AND constraint_name = 'fk_asset_scrap_group'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log("🔄 Dropping foreign key constraint fk_asset_scrap_group...");
      await pool.query(`
        ALTER TABLE "tblAssetScrap"
        DROP CONSTRAINT fk_asset_scrap_group
      `);
      console.log("✅ Dropped foreign key constraint");
    } else {
      console.log("✅ Foreign key constraint fk_asset_scrap_group does not exist (already removed)");
    }

    // Note: We keep asset_group_id as NOT NULL since we always set a value
    // (either a real group ID or an internal group ID like SCRAP_SALES_*)
    // The foreign key constraint is removed to allow internal group IDs

    await pool.query('COMMIT');

    console.log("✅ Migration complete.");
    console.log("📊 Summary:");
    console.log("   - Foreign key constraint fk_asset_scrap_group has been removed");
    console.log("   - asset_group_id column remains NOT NULL (always has a value)");
    console.log("   - Internal group IDs (SCRAP_SALES_*, INDIVIDUAL_ASSET_*) can now be used");
    console.log("   - Real group IDs will still work (just not enforced by FK)");
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error("❌ Migration failed:", e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
