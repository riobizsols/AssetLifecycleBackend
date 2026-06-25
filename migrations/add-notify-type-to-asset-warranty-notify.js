/**
 * Migration: Add notify_type column to tblAssetWarrantyNotify
 * Values: 'WARRANTY' (warranty_period alerts) | 'ASSET_EXPIRY' (expiry_date alerts)
 */
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE "tblAssetWarrantyNotify"
      ADD COLUMN IF NOT EXISTS notify_type VARCHAR(20) NOT NULL DEFAULT 'WARRANTY';
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetWarrantyNotify_notify_type
      ON "tblAssetWarrantyNotify" (notify_type);
    `);
    await client.query("COMMIT");
    console.log("notify_type column added to tblAssetWarrantyNotify");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
