const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MANUAL_EN_BY_TMD_ID = {
  TMD_FAILED_TO_CREATE_ASSET_67770EC0: "Failed to create asset",
  TMD_FAILED_TO_DELETE_ASSETS_846A8366: "Failed to delete assets",
  TMD_FAILED_TO_DELETE_ASSET_295BFB6A: "Failed to delete asset",
  TMD_FAILED_TO_SUBMIT_QSN_PRINT_REQUEST_39D8A39B: "Failed to submit QSN print request",
  TMD_FAILED_TO_UPDATE_ASSET_8578544F: "Failed to update asset",
  TMD_I18N_ASSETS_NOPERMISSIONTOADDASSETS_254881D6: "No permission to add assets",
  TMD_I18N_COMMON_EXPORTSUCCESS_0C579D38: "Export successful",
  TMD_I18N_VENDORS_FAILEDTOFETCHVENDORS_00D2C278: "Failed to fetch vendors",
  TMD_I18N_VENDORS_PLEASESAVEVENDORFIRST_4D3BFE9E: "Please save vendor first",
  TMD_I18N_VENDORS_SAVEFAILED_08205C99: "Save failed",
};

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [tmdId, enText] of Object.entries(MANUAL_EN_BY_TMD_ID)) {
      await client.query(
        `
          UPDATE "tblTextMessagesDefault"
          SET text = $2
          WHERE tmd_id = $1
            AND text = tmd_id
        `,
        [tmdId, enText],
      );
      await client.query(
        `
          UPDATE "tblTextMessagesOtherLangs"
          SET text = $3
          WHERE tmd_id = $1
            AND lang_code = $2
            AND text = tmd_id
        `,
        [tmdId, "de", enText],
      );
    }
    await client.query("COMMIT");

    const defaultRemaining = await client.query(
      `SELECT COUNT(*)::int AS count FROM "tblTextMessagesDefault" WHERE text = tmd_id`,
    );
    const otherRemaining = await client.query(
      `SELECT COUNT(*)::int AS count FROM "tblTextMessagesOtherLangs" WHERE text = tmd_id`,
    );

    console.log(
      JSON.stringify(
        {
          default_remaining: defaultRemaining.rows[0].count,
          otherlangs_remaining: otherRemaining.rows[0].count,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Backfill failed:", error.message);
  process.exit(1);
});
