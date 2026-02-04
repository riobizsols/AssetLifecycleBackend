/**
 * Standalone migration:
 * Adds assignment status codes (A=Assigned, C=Cancelled) to tblStatusCodes
 *
 * Run:
 *   node migrations/addAssignmentStatusCodesStandalone.js
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
    console.log("🔄 Adding assignment status codes to tblStatusCodes...");

    await pool.query(
      `
      INSERT INTO "tblStatusCodes" (status_code, text)
      VALUES
        ('A',  'Assigned'),
        ('C',  'Cancelled')
      ON CONFLICT (status_code) DO UPDATE
      SET text = EXCLUDED.text;
    `
    );

    console.log("✅ Migration complete.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
