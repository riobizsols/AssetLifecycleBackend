/**
 * Migration: Create tblTextMessagesDefault + tblTextMessagesOtherLangs
 *
 * Run:
 *   node migrations/create-text-messages-tables.js
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

    console.log('Creating "tblTextMessagesDefault" (if not present)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblTextMessagesDefault" (
        tmd_id   VARCHAR(80) PRIMARY KEY,
        text     TEXT NOT NULL
      );
    `);

    console.log('Creating "tblTextMessagesOtherLangs" (if not present)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblTextMessagesOtherLangs" (
        tmol_id   VARCHAR(80) PRIMARY KEY,
        tmd_id    VARCHAR(80) NOT NULL,
        text      TEXT NOT NULL,
        lang_code VARCHAR(20) NOT NULL,
        CONSTRAINT fk_tblTextMessagesOtherLangs_tmd_id
          FOREIGN KEY (tmd_id) REFERENCES "tblTextMessagesDefault"(tmd_id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblTextMessagesOtherLangs_tmd_id
      ON "tblTextMessagesOtherLangs"(tmd_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblTextMessagesOtherLangs_lang_code
      ON "tblTextMessagesOtherLangs"(lang_code);
    `);

    // Seed the requested default message (safe/no-dup).
    await client.query(
      `
        INSERT INTO "tblTextMessagesDefault" (tmd_id, text)
        VALUES ($1, $2)
        ON CONFLICT (tmd_id) DO NOTHING;
      `,
      ["TMD_NEW_MAINT_APPROVAL_REQUIRED", "New Maintenance Approval Required"]
    );

    await client.query("COMMIT");
    console.log("✅ Text message tables created/verified successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

