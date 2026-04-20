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

// Get columns for both DBs
const colsSql =
  "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tblJobRoleNav' ORDER BY ordinal_position;";

const assetCols = execFileSync("psql", [assetUrl, "-At", "-F", "\t", "-c", colsSql], { encoding: "utf8" })
  .trim().split("\n").filter(Boolean);

const colList = assetCols.map((c) => `"${c}"`).join(", ");
const appIdIdx = assetCols.indexOf("app_id");
const jobRoleIdIdx = assetCols.indexOf("job_role_id");
const labelIdx = assetCols.indexOf("label");

// Fetch all rows with full detail
const assetRows = execFileSync(
  "psql", [assetUrl, "-At", "-F", "\t", "-c", `SELECT ${colList} FROM "tblJobRoleNav" ORDER BY app_id, job_role_id;`],
  { encoding: "utf8" }
).trim().split("\n").filter(Boolean);

const hospRows = execFileSync(
  "psql", [hospUrl, "-At", "-F", "\t", "-c", `SELECT ${colList} FROM "tblJobRoleNav" ORDER BY app_id, job_role_id;`],
  { encoding: "utf8" }
).trim().split("\n").filter(Boolean);

function rowKey(row) {
  const fields = row.split("\t");
  return fields[appIdIdx] + "|||" + fields[jobRoleIdIdx];
}

const hospKeySet = new Set(hospRows.map(rowKey));
const missingInHosp = assetRows.filter((r) => !hospKeySet.has(rowKey(r)));

console.log("Missing in hospitality: " + missingInHosp.length);
console.log("\nFull detail of each missing row:");
for (const r of missingInHosp) {
  const f = r.split("\t");
  console.log("  app_id=" + f[appIdIdx] + " | job_role_id=" + f[jobRoleIdIdx] + " | label=" + f[labelIdx]);
}

// Check label nullability in hospitality
const nullCheck = execFileSync(
  "psql", [hospUrl, "-At", "-c",
    "SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='tblJobRoleNav' AND column_name='label';"],
  { encoding: "utf8" }
).trim();
console.log("\nhospitality label is_nullable: " + nullCheck);

// Build inserts — for null labels, use app_id text from tblApps as fallback
const insertLines = [
  "-- Insert missing tblJobRoleNav rows into hospitality",
  "-- Rows with NULL label will use app_id as label fallback",
  ""
];

for (const r of missingInHosp) {
  const fields = r.split("\t");
  const colDefs = assetCols.map((c) => `"${c}"`).join(", ");
  const valList = assetCols.map((c, i) => {
    let v = fields[i];
    // Fallback: if label is null/empty, use app_id value
    if (c === "label" && (v === "" || v === undefined || v === null)) {
      v = fields[appIdIdx];
    }
    if (v === "" || v === undefined || v === null) return "NULL";
    return `'${String(v).replace(/'/g, "''")}'`;
  }).join(", ");
  insertLines.push(`INSERT INTO "tblJobRoleNav" (${colDefs})`);
  insertLines.push(`  VALUES (${valList})`);
  insertLines.push(`  ON CONFLICT DO NOTHING;`);
  insertLines.push("");
}

const sqlPath = "/Users/riobizsols/Desktop/Asset Life Cycle/AssetLifecycleBackend/migrations/add_missing_tblJobRoleNav_to_hospitality.sql";
fs.writeFileSync(sqlPath, insertLines.join("\n"), "utf8");
console.log("\nSQL written to: " + sqlPath);

// Execute
try {
  const r = execFileSync("psql", [hospUrl, "-At", "-c", insertLines.join("\n")], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  console.log("Migration executed on hospitality: " + r.trim().replace(/\n/g, " "));
} catch (err) {
  console.error("Migration error:", err.stderr || err.message);
}

// Verify
const countAfter = execFileSync("psql", [hospUrl, "-At", "-c", 'SELECT COUNT(*) FROM "tblJobRoleNav";'], { encoding: "utf8" }).trim();
console.log("hospitality tblJobRoleNav count after: " + countAfter);

const addedAppIds = [...new Set(missingInHosp.map((r) => r.split("\t")[appIdIdx]))].sort();
console.log("\nAPP_IDS ADDED TO HOSPITALITY: " + addedAppIds.join(", "));
