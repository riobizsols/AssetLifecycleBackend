const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const tmdId = process.argv[2];
const deText = process.argv[3];

if (!tmdId || !deText) {
  console.error("Usage: node scripts/update-single-tmd-de.js <TMD_ID> <DE_TEXT>");
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(
      `
        UPDATE "tblTextMessagesOtherLangs"
        SET text = $3
        WHERE tmd_id = $1
          AND lang_code = $2
      `,
      [tmdId, "de", deText],
    );
    console.log("updated");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
