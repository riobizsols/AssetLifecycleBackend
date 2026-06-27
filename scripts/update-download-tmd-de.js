const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const updates = [
  ["TMD_ASSETS_EXPORTED_SUCCESSFULLY_4259789A", "Ressourcen erfolgreich exportiert"],
  ["TMD_FAILED_TO_EXPORT_ASSETS_BFEA8085", "Export der Ressourcen fehlgeschlagen"],
  ["TMD_I18N_ASSETS_PLEASESELECTASSETSTODOWNLOAD_612784DB", "Bitte waehlen Sie Ressourcen zum Herunterladen aus"],
];

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [tmdId, deText] of updates) {
      await client.query(
        `
          UPDATE "tblTextMessagesOtherLangs"
          SET text = $3
          WHERE tmd_id = $1
            AND lang_code = $2
        `,
        [tmdId, "de", deText],
      );
    }
    await client.query("COMMIT");
    console.log("Updated German translations for 3 assets download toasts.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
