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

// Get columns
const colsSql =
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tblJobRoleNav' ORDER BY ordinal_position;";

const assetCols = execFileSync("psql", [assetUrl, "-At", "-F", "\t", "-c", colsSql], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);
const hospCols = execFileSync("psql", [hospUrl, "-At", "-F", "\t", "-c", colsSql], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);

console.log("ASSET_COLS: " + assetCols.join(", "));
console.log("HOSP_COLS:  " + hospCols.join(", "));

// Use asset columns (both should be same, but we use asset as reference)
const colList = assetCols.map((c) => `"${c}"`).join(", ");

const assetDataRaw = execFileSync(
  "psql", [assetUrl, "-At", "-F", "\t", "-c", `SELECT ${colList} FROM "tblJobRoleNav" ORDER BY app_id, job_role_id;`],
  { encoding: "utf8" }
);
const hospDataRaw = execFileSync(
  "psql", [hospUrl, "-At", "-F", "\t", "-c", `SELECT ${colList} FROM "tblJobRoleNav" ORDER BY app_id, job_role_id;`],
  { encoding: "utf8" }
);

const assetRows = assetDataRaw.trim().split("\n").filter(Boolean);
const hospRows = hospDataRaw.trim().split("\n").filter(Boolean);

console.log("\nASSET_ROWS: " + assetRows.length);
console.log("HOSP_ROWS:  " + hospRows.length);

const appIdIdx = assetCols.indexOf("app_id");
const jobRoleIdIdx = assetCols.indexOf("job_role_id");

// Use composite key: app_id + job_role_id
function rowKey(row) {
  const fields = row.split("\t");
  return fields[appIdIdx] + "|||" + fields[jobRoleIdIdx];
}

const assetKeySet = new Set(assetRows.map(rowKey));
const hospKeySet = new Set(hospRows.map(rowKey));

const missingInHosp = assetRows.filter((r) => !hospKeySet.has(rowKey(r)));
const missingInAsset = hospRows.filter((r) => !assetKeySet.has(rowKey(r)));

console.log("\nROWS MISSING IN HOSPITALITY: " + missingInHosp.length);
const missingInHospAppIds = [...new Set(missingInHosp.map((r) => r.split("\t")[appIdIdx]))].sort();
for (const r of missingInHosp) {
  const f = r.split("\t");
  console.log("  app_id: " + f[appIdIdx] + "  job_role_id: " + f[jobRoleIdIdx]);
}

console.log("\nROWS MISSING IN ASSETLIFECYCLE: " + missingInAsset.length);
const missingInAssetAppIds = [...new Set(missingInAsset.map((r) => r.split("\t")[appIdIdx]))].sort();
for (const r of missingInAsset) {
  const f = r.split("\t");
  console.log("  app_id: " + f[appIdIdx] + "  job_role_id: " + f[jobRoleIdIdx]);
}

function buildInserts(rows, cols, targetTable) {
  const lines = [];
  for (const r of rows) {
    const fields = r.split("\t");
    const colDefs = cols.map((c) => `"${c}"`).join(", ");
    const valList = cols.map((_, i) => {
      const v = fields[i];
      if (v === "" || v === undefined) return "NULL";
      return `'${String(v).replace(/'/g, "''")}'`;
    }).join(", ");
    lines.push(`INSERT INTO "${targetTable}" (${colDefs})`);
    lines.push(`  VALUES (${valList})`);
    lines.push(`  ON CONFLICT DO NOTHING;`);
    lines.push("");
  }
  return lines;
}

// Build SQL for hospitality (missing rows from assetLifecycle)
const hospSqlLines = [
  "-- Insert into hospitality: rows present in assetLifecycle but missing in hospitality",
  "-- app_ids added: " + (missingInHospAppIds.join(", ") || "none"),
  "",
  ...buildInserts(missingInHosp, assetCols, "tblJobRoleNav")
];

// Build SQL for assetLifecycle (missing rows from hospitality)
const assetSqlLines = [
  "-- Insert into assetLifecycle: rows present in hospitality but missing in assetLifecycle",
  "-- app_ids added: " + (missingInAssetAppIds.join(", ") || "none"),
  "",
  ...buildInserts(missingInAsset, assetCols, "tblJobRoleNav")
];

const hospSqlPath = "/Users/riobizsols/Desktop/Asset Life Cycle/AssetLifecycleBackend/migrations/add_missing_tblJobRoleNav_to_hospitality.sql";
const assetSqlPath = "/Users/riobizsols/Desktop/Asset Life Cycle/AssetLifecycleBackend/migrations/add_missing_tblJobRoleNav_to_assetLifecycle.sql";
fs.writeFileSync(hospSqlPath, hospSqlLines.join("\n"), "utf8");
fs.writeFileSync(assetSqlPath, assetSqlLines.join("\n"), "utf8");

// Execute on hospitality
if (missingInHosp.length > 0) {
  try {
    const r = execFileSync("psql", [hospUrl, "-At", "-c", hospSqlLines.join("\n")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    console.log("\n[hospitality] Migration executed: " + r.trim().replace(/\n/g, " "));
  } catch (err) {
    console.error("[hospitality] Migration error:", err.stderr || err.message);
  }
} else {
  console.log("\n[hospitality] Nothing to insert.");
}

// Execute on assetLifecycle
if (missingInAsset.length > 0) {
  try {
    const r = execFileSync("psql", [assetUrl, "-At", "-c", assetSqlLines.join("\n")], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    console.log("[assetLifecycle] Migration executed: " + r.trim().replace(/\n/g, " "));
  } catch (err) {
    console.error("[assetLifecycle] Migration error:", err.stderr || err.message);
  }
} else {
  console.log("[assetLifecycle] Nothing to insert.");
}

// Verify counts after
const hospCountAfter = execFileSync("psql", [hospUrl, "-At", "-c", 'SELECT COUNT(*) FROM "tblJobRoleNav";'], { encoding: "utf8" }).trim();
const assetCountAfter = execFileSync("psql", [assetUrl, "-At", "-c", 'SELECT COUNT(*) FROM "tblJobRoleNav";'], { encoding: "utf8" }).trim();
console.log("\nAfter migration:");
console.log("  hospitality tblJobRoleNav count:   " + hospCountAfter);
console.log("  assetLifecycle tblJobRoleNav count: " + assetCountAfter);

console.log("\nAPP_IDS ADDED TO HOSPITALITY:      " + (missingInHospAppIds.join(", ") || "none"));
console.log("APP_IDS ADDED TO ASSETLIFECYCLE:   " + (missingInAssetAppIds.join(", ") || "none"));
