/**
 * Standalone migration:
 * Adds status column to tblScrapSales_H
 *
 * Run:
 *   node migrations/addStatusToScrapSalesHStandalone.js
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
    console.log("🔄 Adding status column to tblScrapSales_H...");

    // Check if column already exists
    const checkColumn = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tblScrapSales_H'
        AND column_name = 'status'
      `
    );

    if (checkColumn.rows.length > 0) {
      console.log("✅ Status column already exists in tblScrapSales_H");
    } else {
      // Add status column
      await pool.query(
        `
        ALTER TABLE "tblScrapSales_H"
        ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'AP'
        CHECK (status IN ('AP', 'IN', 'CO', 'CA'));
      `
      );

      // Update existing records to 'IN' (assuming they were already processed)
      await pool.query(
        `
        UPDATE "tblScrapSales_H"
        SET status = 'IN'
        WHERE status IS NULL OR status = '';
      `
      );

      console.log("✅ Status column added to tblScrapSales_H");
    }

    console.log("✅ Migration complete.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
