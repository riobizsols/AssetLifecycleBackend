const path = require("path");
const { Pool } = require("pg");
const { seedTextMessagesFromFrontend } = require("../utils/seedTextMessages");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const FRONTEND_SRC = path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src");

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await seedTextMessagesFromFrontend(client, FRONTEND_SRC);
    await client.query("COMMIT");
    console.log(
      `Seed completed from frontend. Defaults: ${result.defaultCount}, translations: ${result.translationCount}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
