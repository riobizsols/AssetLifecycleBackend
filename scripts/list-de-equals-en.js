const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const sql = `
      SELECT d.tmd_id, d.text AS en_text, o.text AS de_text
      FROM "tblTextMessagesDefault" d
      JOIN "tblTextMessagesOtherLangs" o
        ON o.tmd_id = d.tmd_id
       AND o.lang_code = 'de'
      WHERE d.text = o.text
        AND d.tmd_id LIKE 'TMD_%'
      ORDER BY d.tmd_id
      LIMIT 500
    `;
    const result = await client.query(sql);
    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
