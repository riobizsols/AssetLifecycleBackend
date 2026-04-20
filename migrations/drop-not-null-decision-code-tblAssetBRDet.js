/**
 * Migration: Drop NOT NULL on tblAssetBRDet.decision_code
 *
 * Run:
 *   node migrations/drop-not-null-decision-code-tblAssetBRDet.js
 */
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL not found in environment variables");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log('Dropping NOT NULL constraint on "tblAssetBRDet"."decision_code" (if present)...');
    await client.query(`
      ALTER TABLE "tblAssetBRDet"
      ALTER COLUMN decision_code DROP NOT NULL;
    `);

    await client.query("COMMIT");
    console.log("✅ decision_code is now nullable.");
  } catch (err) {
    await client.query("ROLLBACK");
    // If column/table doesn't exist, surface the error clearly.
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

