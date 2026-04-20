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
const sql = fs.readFileSync(
  "/Users/riobizsols/Desktop/Asset Life Cycle/AssetLifecycleBackend/migrations/add_missing_tblApps_to_hospitality.sql",
  "utf8"
);

try {
  const result = execFileSync("psql", [hospUrl, "-At", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  console.log("Migration executed successfully.");
  console.log(result.trim());
} catch (err) {
  console.error("Migration failed:");
  console.error(err.stderr || err.message);
}

// Verify
const verifySql = "SELECT app_id, text FROM \"tblApps\" WHERE app_id IN ('COSTCENTERTRANSFER','EMPLOYEE TECH CERTIFICATION','INSPECTIONAPPROVAL','INSPECTIONVIEW') ORDER BY app_id;";
const verify = execFileSync("psql", [hospUrl, "-At", "-F", "\t", "-c", verifySql], {
  encoding: "utf8"
});
console.log("\nVerification - rows now in hospitality tblApps:");
for (const row of verify.trim().split("\n").filter(Boolean)) {
  const [id, text] = row.split("\t");
  console.log(`  app_id: ${id}  |  text: ${text}`);
}
