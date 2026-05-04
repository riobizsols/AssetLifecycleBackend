const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const FILES = [
  path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src", "pages", "Assets.jsx"),
  path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src", "components", "assets", "AddAssetForm.jsx"),
  path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src", "components", "assets", "UpdateAssetModal.jsx"),
  path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src", "components", "assetAssignment", "AssetSelection.jsx"),
  path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src", "components", "assetAssignment", "AssetsDetail.jsx"),
  path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src", "components", "assetAssignment", "AssetAssignmentList.jsx"),
];

function getTmdIds() {
  const ids = new Set();
  for (const file of FILES) {
    const content = fs.readFileSync(file, "utf8");
    for (const m of content.matchAll(/tmdId:\s*'([^']+)'/g)) {
      ids.add(m[1]);
    }
  }
  return Array.from(ids);
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing");
  }

  const ids = getTmdIds();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
        SELECT
          d.tmd_id,
          d.text AS en_text,
          o.text AS de_text,
          CASE WHEN o.tmd_id IS NULL THEN false ELSE true END AS has_de
        FROM "tblTextMessagesDefault" d
        LEFT JOIN "tblTextMessagesOtherLangs" o
          ON o.tmd_id = d.tmd_id
         AND o.lang_code = 'de'
        WHERE d.tmd_id = ANY($1::text[])
        ORDER BY d.tmd_id;
      `,
      [ids],
    );

    const missingDefault = ids.filter((id) => !result.rows.find((r) => r.tmd_id === id));
    const missingGerman = result.rows.filter((r) => !r.has_de).map((r) => r.tmd_id);
    const germanSameAsEnglish = result.rows.filter((r) => r.has_de && r.en_text === r.de_text).length;

    console.log(
      JSON.stringify(
        {
          asset_scope_tmd_ids_in_code: ids.length,
          default_rows_found: result.rows.length,
          missing_default_count: missingDefault.length,
          missing_default_ids: missingDefault,
          missing_german_count: missingGerman.length,
          missing_german_ids: missingGerman,
          german_same_as_english_count: germanSameAsEnglish,
        },
        null,
        2,
      ),
    );
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Verification failed:", error.message);
  process.exit(1);
});
