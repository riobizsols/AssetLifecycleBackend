const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const IDS = [
  "TMD_I18N_ASSETS_PLEASESELECTASSETSTODOWNLOAD_612784DB",
  "TMD_ASSETS_EXPORTED_SUCCESSFULLY_4259789A",
  "TMD_FAILED_TO_EXPORT_ASSETS_BFEA8085",
];

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
        SELECT
          d.tmd_id,
          d.text AS default_en,
          o.lang_code,
          o.text AS de_text
        FROM "tblTextMessagesDefault" d
        LEFT JOIN "tblTextMessagesOtherLangs" o
          ON o.tmd_id = d.tmd_id
         AND o.lang_code = 'de'
        WHERE d.tmd_id = ANY($1::text[])
        ORDER BY d.tmd_id
      `,
      [IDS],
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
