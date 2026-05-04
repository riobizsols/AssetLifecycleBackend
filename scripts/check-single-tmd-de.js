const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const tmdId = process.argv[2];

if (!tmdId) {
  console.error("Usage: node scripts/check-single-tmd-de.js <TMD_ID>");
  process.exit(1);
}

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT
          d.tmd_id,
          d.text AS en_text,
          o.lang_code,
          o.text AS de_text
        FROM "tblTextMessagesDefault" d
        LEFT JOIN "tblTextMessagesOtherLangs" o
          ON o.tmd_id = d.tmd_id
         AND o.lang_code = 'de'
        WHERE d.tmd_id = $1
      `,
      [tmdId],
    );
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
