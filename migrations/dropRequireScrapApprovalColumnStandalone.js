/**
 * Standalone migration:
 * Drops require_scrap_approval column from tblAssetTypes
 * 
 * Reason: Workflow is now mandatory for all scrap assets and scrap sales
 * (except when maint_required = false, which bypasses workflow)
 *
 * Run:
 *   node migrations/dropRequireScrapApprovalColumnStandalone.js
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
    console.log("🔄 Dropping require_scrap_approval column from tblAssetTypes...");

    await pool.query('BEGIN');

    // Check if column exists
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tblAssetTypes'
        AND column_name = 'require_scrap_approval'
    `);

    if (columnCheck.rows.length > 0) {
      console.log("🔄 Dropping column require_scrap_approval...");
      await pool.query(`
        ALTER TABLE "tblAssetTypes"
        DROP COLUMN require_scrap_approval
      `);
      console.log("✅ Dropped require_scrap_approval column");
    } else {
      console.log("✅ Column require_scrap_approval does not exist (already removed)");
    }

    await pool.query('COMMIT');

    console.log("✅ Migration complete.");
    console.log("📊 Summary:");
    console.log("   - Dropped require_scrap_approval column from tblAssetTypes");
    console.log("   - Workflow is now mandatory for all scrap operations");
    console.log("   - (Exception: maint_required = false still bypasses workflow)");
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
