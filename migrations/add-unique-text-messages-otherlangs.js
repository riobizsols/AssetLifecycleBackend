/**
 * Migration: Add unique constraint to tblTextMessagesOtherLangs (tmd_id, lang_code)
 *
 * Run:
 *   node migrations/add-unique-text-messages-otherlangs.js
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

    // Ensure we don't have duplicates before adding unique constraint
    await client.query(`
      DELETE FROM "tblTextMessagesOtherLangs" a
      USING "tblTextMessagesOtherLangs" b
      WHERE a.ctid < b.ctid
        AND a.tmd_id = b.tmd_id
        AND a.lang_code = b.lang_code;
    `);

    await client.query(`
      ALTER TABLE "tblTextMessagesOtherLangs"
      ADD CONSTRAINT uq_tblTextMessagesOtherLangs_tmd_lang
      UNIQUE (tmd_id, lang_code);
    `);

    await client.query("COMMIT");
    console.log("✅ Unique constraint added to tblTextMessagesOtherLangs (tmd_id, lang_code).");
  } catch (err) {
    await client.query("ROLLBACK");
    // If constraint already exists, treat as success.
    if ((err.message || "").toLowerCase().includes("already exists")) {
      console.log("ℹ️ Unique constraint already exists. Skipping.");
      return;
    }
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

