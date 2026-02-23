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

const hospUrl = config.DATABASE_URL;
const assetUrl = config.GENERIC_URL;

const appIds = [
  "INSPECTIONAPPROVAL",
  "INSPECTIONVIEW",
  "INSPECTIONFREQUENCY",
  "INSPECTIONCHECKLISTS",
  "CERTIFICATIONS",
  "TECHCERTUPLOAD",
  "EMPLOYEE TECH CERTIFICATION",
  "HR/MANAGERAPPROVAL"
];

const appIdList = appIds.map(a => `'${a.replace(/'/g,"''")}'`).join(",");

// 1. Check tblApps in hospitality
const appsSql = `SELECT app_id, text, int_status FROM "tblApps" WHERE app_id IN (${appIdList}) ORDER BY app_id;`;
const hospApps = execFileSync("psql", [hospUrl, "-At", "-F", "|", "-c", appsSql], { encoding: "utf8" }).trim();
const assetApps = execFileSync("psql", [assetUrl, "-At", "-F", "|", "-c", appsSql], { encoding: "utf8" }).trim();

console.log("=== tblApps in HOSPITALITY ===");
console.log(hospApps || "(none)");
console.log("\n=== tblApps in ASSETLIFECYCLE ===");
console.log(assetApps || "(none)");

// 2. Check tblJobRoleNav in hospitality
const navSql = `SELECT app_id, job_role_id, label, int_status, mob_desk FROM "tblJobRoleNav" WHERE app_id IN (${appIdList}) ORDER BY app_id, job_role_id;`;
const hospNav = execFileSync("psql", [hospUrl, "-At", "-F", "|", "-c", navSql], { encoding: "utf8" }).trim();
const assetNav = execFileSync("psql", [assetUrl, "-At", "-F", "|", "-c", navSql], { encoding: "utf8" }).trim();

console.log("\n=== tblJobRoleNav in HOSPITALITY ===");
console.log(hospNav || "(none)");
console.log("\n=== tblJobRoleNav in ASSETLIFECYCLE ===");
console.log(assetNav || "(none)");

// 3. Check tblNavigation in hospitality
const navTableCheckSql = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tblNavigation');`;
const hospNavTableExists = execFileSync("psql", [hospUrl, "-At", "-c", navTableCheckSql], { encoding: "utf8" }).trim();
const assetNavTableExists = execFileSync("psql", [assetUrl, "-At", "-c", navTableCheckSql], { encoding: "utf8" }).trim();

console.log("\n=== tblNavigation exists? hospitality:", hospNavTableExists, "| assetLifecycle:", assetNavTableExists);

if (hospNavTableExists === "t") {
  // Check columns
  const navColsSql = `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tblNavigation' ORDER BY ordinal_position;`;
  const navCols = execFileSync("psql", [hospUrl, "-At", "-c", navColsSql], { encoding: "utf8" }).trim();
  console.log("tblNavigation columns:", navCols.replace(/\n/g, ", "));

  // Try to find matching rows
  let navDataSql = `SELECT * FROM "tblNavigation" LIMIT 3;`;
  const navData = execFileSync("psql", [hospUrl, "-At", "-F", "|", "-c", navDataSql], { encoding: "utf8" }).trim();
  console.log("tblNavigation sample rows:\n" + navData);
}

// 4. Check DatabaseSidebar mapping for these app_ids
console.log("\n=== SUMMARY of missing vs present ===");
const hospAppSet = new Set(hospApps.split("\n").filter(Boolean).map(r => r.split("|")[0]));
const hospNavSet = new Set(hospNav.split("\n").filter(Boolean).map(r => r.split("|")[0]));

for (const appId of appIds) {
  const inApps = hospAppSet.has(appId) ? "YES" : "NO";
  const inNav = hospNavSet.has(appId) ? "YES" : "NO";
  console.log(`  ${appId.padEnd(35)} tblApps:${inApps}  tblJobRoleNav:${inNav}`);
}
