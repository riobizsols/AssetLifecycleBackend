/**
 * Migration: Change tblAssets.warranty_period from varchar/text to DATE.
 *
 * Run:
 *   node migrations/alter-warranty-period-to-date.js
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

    console.log('Checking current data type for "tblAssets"."warranty_period"...');
    const typeRes = await client.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_name = 'tblAssets'
        AND column_name = 'warranty_period'
      LIMIT 1
    `);

    const currentType = typeRes.rows[0]?.data_type || "";
    if (currentType === "date") {
      console.log("ℹ️ warranty_period is already DATE. No changes required.");
      await client.query("COMMIT");
      return;
    }

    const nonConvertibleRes = await client.query(`
      SELECT COUNT(*)::int AS non_convertible_count
      FROM "tblAssets"
      WHERE warranty_period IS NOT NULL
        AND btrim(warranty_period::text) <> ''
        AND NOT (
          warranty_period::text ~ '^\\d{4}-\\d{2}-\\d{2}$'
          OR warranty_period::text ~ '^\\d{2}/\\d{2}/\\d{4}$'
          OR warranty_period::text ~ '^\\d{2}-\\d{2}-\\d{4}$'
        )
    `);

    const nonConvertibleCount = nonConvertibleRes.rows[0]?.non_convertible_count || 0;
    if (nonConvertibleCount > 0) {
      console.log(
        `⚠️ ${nonConvertibleCount} existing values are not date-formatted and will become NULL.`
      );
    }

    console.log('Altering "tblAssets"."warranty_period" to DATE...');
    await client.query(`
      ALTER TABLE "tblAssets"
      ALTER COLUMN warranty_period TYPE DATE
      USING (
        CASE
          WHEN warranty_period IS NULL OR btrim(warranty_period::text) = '' THEN NULL
          WHEN warranty_period::text ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN warranty_period::date
          WHEN warranty_period::text ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(warranty_period::text, 'DD/MM/YYYY')
          WHEN warranty_period::text ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN to_date(warranty_period::text, 'DD-MM-YYYY')
          ELSE NULL
        END
      )
    `);

    await client.query("COMMIT");
    console.log("✅ warranty_period converted to DATE successfully.");
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
