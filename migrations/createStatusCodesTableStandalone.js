/**
 * Standalone migration:
 * Creates tblStatusCodes (and seeds default status codes).
 *
 * Columns:
 *  - id (bigserial, PK)
 *  - status_code (varchar(3))
 *  - text (varchar(50))
 *
 * Run:
 *   node migrations/createStatusCodesTableStandalone.js
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
    console.log("🔄 Creating tblStatusCodes...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "tblStatusCodes" (
        id BIGSERIAL PRIMARY KEY,
        status_code VARCHAR(3) NOT NULL,
        text VARCHAR(50) NOT NULL
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "tblStatusCodes_status_code_uq"
      ON "tblStatusCodes"(status_code);
    `);

    console.log("🔄 Seeding default status codes...");

    await pool.query(
      `
      INSERT INTO "tblStatusCodes" (status_code, text)
      VALUES
        ('IN',  'Initiated'),
        ('PEN', 'Pending'),
        ('IP',  'In Progress'),
        ('CO',  'Completed'),
        ('CA',  'Cancelled')
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

