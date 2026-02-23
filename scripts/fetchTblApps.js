const fs = require("fs");
const { execFileSync } = require("child_process");

const envText = fs.readFileSync(
  "/Users/riobizsols/Desktop/Asset Life Cycle/AssetLifecycleBackend/.env",
  "utf8"
);
const config = {};
for (const rawLine of envText.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const idx = line.indexOf("=");
  const key = line.slice(0, idx).trim();
  let value = line.slice(idx + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  config[key] = value;
}

const assetUrl = config.GENERIC_URL;
const hospUrl = config.DATABASE_URL;

// Get columns of tblApps
const colsSql =
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tblApps' ORDER BY ordinal_position;";

const assetColsRaw = execFileSync("psql", [assetUrl, "-At", "-F", "\t", "-c", colsSql], {
  encoding: "utf8"
});
const hospColsRaw = execFileSync("psql", [hospUrl, "-At", "-F", "\t", "-c", colsSql], {
  encoding: "utf8"
});
const assetCols = assetColsRaw.trim().split("\n").filter(Boolean);
const hospCols = hospColsRaw.trim().split("\n").filter(Boolean);

console.log("ASSET_COLS: " + assetCols.join(", "));
console.log("HOSP_COLS:  " + hospCols.join(", "));

// Get all data from both - using asset columns order
const colList = assetCols.map((c) => `"${c}"`).join(", ");
const dataSql = `SELECT ${colList} FROM "tblApps" ORDER BY app_id;`;

const assetData = execFileSync("psql", [assetUrl, "-At", "-F", "\t", "-c", dataSql], {
  encoding: "utf8"
});
const hospData = execFileSync("psql", [hospUrl, "-At", "-F", "\t", "-c", dataSql], {
  encoding: "utf8"
});

fs.writeFileSync("/tmp/tblApps_asset.tsv", assetData);
fs.writeFileSync("/tmp/tblApps_hosp.tsv", hospData);

const assetRows = assetData.trim().split("\n").filter(Boolean);
const hospRows = hospData.trim().split("\n").filter(Boolean);

console.log("ASSET_ROWS: " + assetRows.length);
console.log("HOSP_ROWS:  " + hospRows.length);

// Find app_id column index
const appIdIdx = assetCols.indexOf("app_id");

// Build set of hosp app_ids
const hospAppIds = new Set(
  hospRows.map((r) => r.split("\t")[appIdIdx])
);

// Find rows in asset but not in hosp
const missingRows = assetRows.filter((r) => {
  const appId = r.split("\t")[appIdIdx];
  return !hospAppIds.has(appId);
});

console.log("\nROWS_MISSING_IN_HOSPITALITY: " + missingRows.length);
for (const r of missingRows) {
  const fields = r.split("\t");
  const appId = fields[appIdIdx];
  const label = fields[assetCols.indexOf("label")] || "";
  console.log(`  app_id: ${appId}  label: ${label}`);
}

// Generate SQL
const lines = [
  "-- Migration: Insert missing tblApps rows from assetLifecycle into hospitality",
  "-- Generated: " + new Date().toISOString(),
  "-- Missing app_ids: " + missingRows.map((r) => r.split("\t")[appIdIdx]).join(", "),
  ""
];

for (const r of missingRows) {
  const fields = r.split("\t");
  const valList = assetCols
    .map((_, i) => {
      const v = fields[i];
      if (v === "" || v === undefined || v === null) return "NULL";
      // Escape single quotes
      return `'${String(v).replace(/'/g, "''")}'`;
    })
    .join(", ");
  const colDefs = assetCols.map((c) => `"${c}"`).join(", ");
  lines.push(`INSERT INTO "tblApps" (${colDefs})`);
  lines.push(`  VALUES (${valList})`);
  lines.push(`  ON CONFLICT (app_id) DO NOTHING;`);
  lines.push("");
}

const outPath =
  "/Users/riobizsols/Desktop/Asset Life Cycle/AssetLifecycleBackend/migrations/add_missing_tblApps_to_hospitality.sql";
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log("\nSQL written to: " + outPath);
