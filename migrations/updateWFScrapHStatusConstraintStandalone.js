/**
 * Migration: Update tblWFScrap_H status constraint to allow 'AP' status
 * 
 * This allows scrap sales workflows to use 'AP' (Approval Pending) status
 * when initially created, which is needed for the scrap sales workflow.
 */

const { Pool } = require('pg');
require('dotenv').config();

const run = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log("🔄 Updating tblWFScrap_H status constraint to allow 'AP' status...");

    // Drop the existing constraint
    await pool.query(`
      ALTER TABLE "tblWFScrap_H"
      DROP CONSTRAINT IF EXISTS chk_tblwfscrap_h_status_status;
    `);

    // Add the new constraint with 'AP' included
    await pool.query(`
      ALTER TABLE "tblWFScrap_H"
      ADD CONSTRAINT chk_tblwfscrap_h_status_status
      CHECK (status IN ('IN','IP','CO','CA','AP'));
    `);

    console.log("✅ Status constraint updated successfully. Allowed values: IN, IP, CO, CA, AP");
    console.log("✅ Migration complete.");
  } catch (e) {
    console.error("❌ Migration failed:", e.message);
    console.error(e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
