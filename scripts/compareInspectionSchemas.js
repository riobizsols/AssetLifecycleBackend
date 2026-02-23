const fs = require("fs");
const { execFileSync } = require("child_process");

const envPath = "/Users/riobizsols/Desktop/Asset Life Cycle/AssetLifecycleBackend/.env";
const envText = fs.readFileSync(envPath, "utf8");
const config = {};
for (const rawLine of envText.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const idx = line.indexOf("=");
  const key = line.slice(0, idx).trim();
  let value = line.slice(idx + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  config[key] = value;
}

const assetUrl = config.GENERIC_URL;
const hospUrl = config.DATABASE_URL;
if (!assetUrl || !hospUrl) {
  console.error("Missing GENERIC_URL or DATABASE_URL in .env");
  process.exit(1);
}

const sqlTables =
  "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;";
const sqlColumns =
  "SELECT table_name, column_name, data_type, is_nullable, udt_name, COALESCE(character_maximum_length::text,''), COALESCE(numeric_precision::text,''), COALESCE(datetime_precision::text,''), COALESCE(collation_name,''), COALESCE(column_default,'') FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position;";

function runPsql(conn, sql, outPath) {
  const out = execFileSync("psql", [conn, "-At", "-F", "\t", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  fs.writeFileSync(outPath, out, "utf8");
}

const assetTablesPath = "/tmp/asset_tables.tsv";
const hospTablesPath = "/tmp/hospitality_tables.tsv";
const assetColsPath = "/tmp/asset_columns.tsv";
const hospColsPath = "/tmp/hospitality_columns.tsv";

runPsql(assetUrl, sqlTables, assetTablesPath);
runPsql(hospUrl, sqlTables, hospTablesPath);
runPsql(assetUrl, sqlColumns, assetColsPath);
runPsql(hospUrl, sqlColumns, hospColsPath);

function loadTables(path) {
  return fs.readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
}

function loadColumns(path) {
  const rows = fs.readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  const map = new Map();
  for (const row of rows) {
    const [table, column, data_type, is_nullable, udt_name, char_len, num_prec, dt_prec, coll, def] = row.split("\t");
    if (!map.has(table)) map.set(table, []);
    map.get(table).push({ column, data_type, is_nullable, udt_name, char_len, num_prec, dt_prec, coll, def });
  }
  return map;
}

function colKey(c) {
  return [
    c.column,
    c.data_type,
    c.is_nullable,
    c.udt_name,
    c.char_len,
    c.num_prec,
    c.dt_prec,
    c.coll,
    c.def
  ].join("|");
}

function compareColumns(colsA, colsB) {
  const report = new Map();
  const tables = new Set([...colsA.keys(), ...colsB.keys()]);
  for (const table of tables) {
    const aList = colsA.get(table) || [];
    const bList = colsB.get(table) || [];
    const aSet = new Map(aList.map((c) => [colKey(c), c]));
    const bSet = new Map(bList.map((c) => [colKey(c), c]));
    const missingInB = [];
    const missingInA = [];
    for (const key of aSet.keys()) if (!bSet.has(key)) missingInB.push(aSet.get(key));
    for (const key of bSet.keys()) if (!aSet.has(key)) missingInA.push(bSet.get(key));
    if (missingInA.length || missingInB.length) report.set(table, { missingInB, missingInA });
  }
  return report;
}

const assetTables = loadTables(assetTablesPath);
const hospTables = loadTables(hospTablesPath);
const assetSet = new Set(assetTables);
const hospSet = new Set(hospTables);

const missingInHosp = [...assetSet].filter((t) => !hospSet.has(t)).sort();
const missingInAsset = [...hospSet].filter((t) => !assetSet.has(t)).sort();

const assetCols = loadColumns(assetColsPath);
const hospCols = loadColumns(hospColsPath);
const report = compareColumns(assetCols, hospCols);

const inspTables = [...new Set([...assetSet, ...hospSet])]
  .filter((t) => t.toLowerCase().includes("insp"))
  .sort();

console.log("TABLES_MISSING_IN_HOSPITALITY");
for (const t of missingInHosp) console.log(t);
console.log("END_TABLES_MISSING_IN_HOSPITALITY");

console.log("TABLES_MISSING_IN_ASSETLIFECYCLE");
for (const t of missingInAsset) console.log(t);
console.log("END_TABLES_MISSING_IN_ASSETLIFECYCLE");

console.log("INSPECTION_TABLES");
for (const t of inspTables) console.log(t);
console.log("END_INSPECTION_TABLES");

console.log("COLUMN_DIFFS");
for (const table of [...report.keys()].sort()) {
  if (!inspTables.includes(table)) continue;
  const { missingInB, missingInA } = report.get(table);
  if (missingInB.length) {
    console.log(`-- ${table}: missing in hospitality`);
    for (const c of missingInB) {
      console.log(
        `${c.column}|${c.data_type}|${c.is_nullable}|${c.udt_name}|${c.char_len}|${c.num_prec}|${c.dt_prec}|${c.coll}|${c.def}`
      );
    }
  }
  if (missingInA.length) {
    console.log(`-- ${table}: missing in assetLifecycle`);
    for (const c of missingInA) {
      console.log(
        `${c.column}|${c.data_type}|${c.is_nullable}|${c.udt_name}|${c.char_len}|${c.num_prec}|${c.dt_prec}|${c.coll}|${c.def}`
      );
    }
  }
}
console.log("END_COLUMN_DIFFS");

console.log("COLUMN_DIFFS_NON_INSP");
for (const table of [...report.keys()].sort()) {
  if (inspTables.includes(table)) continue;
  const { missingInB, missingInA } = report.get(table);
  if (missingInB.length || missingInA.length) {
    console.log(`-- ${table}`);
    if (missingInB.length) console.log(`  missing in hospitality: ${missingInB.length}`);
    if (missingInA.length) console.log(`  missing in assetLifecycle: ${missingInA.length}`);
  }
}
console.log("END_COLUMN_DIFFS_NON_INSP");
