const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const FRONTEND_ROOT = path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src");
const DE_FILE = path.join(FRONTEND_ROOT, "i18n", "locales", "de.json");

const TARGET_FILES = [
  path.join(FRONTEND_ROOT, "pages", "AssetType.jsx"),
  path.join(FRONTEND_ROOT, "components", "AddAssetType.jsx"),
  path.join(FRONTEND_ROOT, "components", "UpdateAssetTypeModal.jsx"),
];

function flatten(obj, prefix = "", out = {}) {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

function extractPairs(content, deMap) {
  const pairs = [];
  const regex = /showBackendTextToast\(\s*\{([\s\S]*?)\}\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const block = match[1] || "";
    const tmd = block.match(/tmdId\s*:\s*['"`]([^'"`]+)['"`]/);
    const i18n = block.match(/fallbackText\s*:\s*t\(\s*['"`]([^'"`]+)['"`]/);
    if (!tmd || !i18n) continue;
    const tmdId = tmd[1];
    const key = i18n[1];
    const deText = deMap[key];
    if (deText && deText.trim()) pairs.push({ tmdId, deText });
  }
  return pairs;
}

async function run() {
  const deMap = flatten(JSON.parse(fs.readFileSync(DE_FILE, "utf8")));
  const allPairs = [];
  for (const file of TARGET_FILES) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    allPairs.push(...extractPairs(content, deMap));
  }

  const dedup = Array.from(new Map(allPairs.map((p) => [p.tmdId, p])).values());
  if (!dedup.length) {
    console.log("No asset-type i18n-backed tmd rows found.");
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of dedup) {
      await client.query(
        `
          UPDATE "tblTextMessagesOtherLangs"
          SET text = $3
          WHERE tmd_id = $1
            AND lang_code = $2
        `,
        [row.tmdId, "de", row.deText],
      );
    }
    await client.query("COMMIT");
    console.log(`Updated German text for ${dedup.length} asset-type-flow tmd_id rows.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("sync failed:", err.message);
  process.exit(1);
});
