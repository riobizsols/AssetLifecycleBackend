const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Pool } = require("pg");

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const tmdId = "TMD_I18N_VENDORS_PLEASEFILLREQUIREDFIELDS_2A8D8CDD";

  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE "tblTextMessagesDefault" SET text = $2 WHERE tmd_id = $1`,
      [tmdId, "Please correct the following fields: {{details}}"],
    );
    await client.query(
      `UPDATE "tblTextMessagesOtherLangs" SET text = $3 WHERE tmd_id = $1 AND lang_code = $2`,
      [tmdId, "de", "Bitte korrigieren Sie die folgenden Felder: {{details}}"],
    );
    await client.query("COMMIT");

    const defaultRow = await client.query(
      `SELECT tmd_id, text FROM "tblTextMessagesDefault" WHERE tmd_id = $1`,
      [tmdId],
    );
    const deRow = await client.query(
      `SELECT tmd_id, lang_code, text FROM "tblTextMessagesOtherLangs" WHERE tmd_id = $1 AND lang_code = $2`,
      [tmdId, "de"],
    );

    console.log(
      JSON.stringify(
        {
          defaultRow: defaultRow.rows[0],
          deRow: deRow.rows[0],
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
