const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const FRONTEND_ROOT = path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src");
const EN_FILE = path.join(FRONTEND_ROOT, "i18n", "locales", "en.json");
const DE_FILE = path.join(FRONTEND_ROOT, "i18n", "locales", "de.json");

const TARGET_FILES = [
  path.join(FRONTEND_ROOT, "pages", "adminSettings", "Certifications.jsx"),
  path.join(FRONTEND_ROOT, "pages", "AuditLogsView.jsx"),
  path.join(FRONTEND_ROOT, "pages", "VendorRenewalApproval.jsx"),
  path.join(FRONTEND_ROOT, "pages", "TechCertApprovals.jsx"),
  path.join(FRONTEND_ROOT, "pages", "TechnicianCertificates.jsx"),
  path.join(FRONTEND_ROOT, "pages", "ScrapSales.jsx"),
  path.join(FRONTEND_ROOT, "pages", "ScrapAssets.jsx"),
  path.join(FRONTEND_ROOT, "pages", "GroupAsset.jsx"),
  path.join(FRONTEND_ROOT, "components", "groupAsset", "CreateGroupAsset.jsx"),
  path.join(FRONTEND_ROOT, "components", "groupAsset", "EditGroupAsset.jsx"),
  path.join(FRONTEND_ROOT, "components", "groupAsset", "ViewGroupAsset.jsx"),
  path.join(FRONTEND_ROOT, "components", "scrapSales", "CreateScrapSales.jsx"),
  path.join(FRONTEND_ROOT, "components", "scrapSales", "EditScrapSales.jsx"),
  path.join(FRONTEND_ROOT, "components", "scrapSales", "ViewScrapSales.jsx"),
  path.join(FRONTEND_ROOT, "components", "scrapAssets", "NearingExpiry.jsx"),
  path.join(FRONTEND_ROOT, "components", "scrapAssets", "ExpiredAssets.jsx"),
  path.join(FRONTEND_ROOT, "components", "scrapAssets", "ExpiringByCategory.jsx"),
  path.join(FRONTEND_ROOT, "components", "scrapAssets", "CategoryAssets.jsx"),
  path.join(FRONTEND_ROOT, "components", "scrapAssets", "CategoriesOverview.jsx"),
  path.join(FRONTEND_ROOT, "components", "scrapAssets", "CreateScrapAsset.jsx"),
  path.join(FRONTEND_ROOT, "pages", "masterData", "Vendors.jsx"),
  path.join(FRONTEND_ROOT, "components", "AddEntityForm.jsx"),
  path.join(FRONTEND_ROOT, "pages", "MaintenanceSupervisor.jsx"),
  path.join(FRONTEND_ROOT, "pages", "CreateManualMaintenance.jsx"),
  path.join(FRONTEND_ROOT, "components", "MaintSupervisorApproval.jsx"),
  path.join(FRONTEND_ROOT, "pages", "reports", "SerialNumberPrint.jsx"),
  path.join(FRONTEND_ROOT, "pages", "masterData", "UserRoles.jsx"),
  path.join(FRONTEND_ROOT, "pages", "ReportsBreakdown.jsx"),
  path.join(FRONTEND_ROOT, "pages", "ReportsBreakdown2.jsx"),
  path.join(FRONTEND_ROOT, "components", "reportbreakdown", "BreakdownSelection.jsx"),
  path.join(FRONTEND_ROOT, "components", "reportbreakdown", "BreakdownSelection2.jsx"),
  path.join(FRONTEND_ROOT, "components", "reportbreakdown", "BreakdownDetails.jsx"),
  path.join(FRONTEND_ROOT, "components", "reportbreakdown", "BreakdownDetails2.jsx"),
  path.join(FRONTEND_ROOT, "components", "reportbreakdown", "EditBreakdownReport.jsx"),
  path.join(FRONTEND_ROOT, "components", "InspectionApprovalDetail.jsx"),
  path.join(FRONTEND_ROOT, "pages", "InspectionApproval.jsx"),
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

function parseToastBlocks(content) {
  const blocks = [];
  const regex = /showBackendTextToast\(\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const block = m[1] || "";
    const tmdMatch = block.match(/tmdId\s*:\s*['"`]([^'"`]+)['"`]/);
    if (!tmdMatch) continue;
    const tmdId = tmdMatch[1];
    const i18nKey = block.match(/fallbackText\s*:\s*t\(\s*['"`]([^'"`]+)['"`]/)?.[1] || null;
    const literal = block.match(/fallbackText\s*:\s*['"`]([\s\S]*?)['"`]/)?.[1] || null;
    blocks.push({ tmdId, i18nKey, literal });
  }
  return blocks;
}

function autoDeFromEnglish(enText) {
  // Keep placeholders readable; best-effort fallback when no de key is present.
  return enText;
}

async function run() {
  const enMap = flatten(JSON.parse(fs.readFileSync(EN_FILE, "utf8")));
  const deMap = flatten(JSON.parse(fs.readFileSync(DE_FILE, "utf8")));

  const rows = [];
  for (const file of TARGET_FILES) {
    if (!fs.existsSync(file)) continue;
    const blocks = parseToastBlocks(fs.readFileSync(file, "utf8"));
    rows.push(...blocks);
  }

  const unique = Array.from(new Map(rows.map((r) => [r.tmdId, r])).values()).map((r) => {
    const enText = (r.i18nKey && enMap[r.i18nKey]) || r.literal || r.tmdId;
    const deText = (r.i18nKey && deMap[r.i18nKey]) || autoDeFromEnglish(enText);
    return { tmdId: r.tmdId, enText, deText };
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of unique) {
      await client.query(
        `
          INSERT INTO "tblTextMessagesDefault" (tmd_id, text)
          VALUES ($1, $2)
          ON CONFLICT (tmd_id)
          DO UPDATE SET text = CASE
            WHEN "tblTextMessagesDefault".text = "tblTextMessagesDefault".tmd_id THEN EXCLUDED.text
            ELSE "tblTextMessagesDefault".text
          END
        `,
        [row.tmdId, row.enText],
      );
      await client.query(
        `
          INSERT INTO "tblTextMessagesOtherLangs" (tmol_id, tmd_id, lang_code, text)
          VALUES ($1, $2, 'de', $3)
          ON CONFLICT (tmd_id, lang_code)
          DO UPDATE SET text = EXCLUDED.text
        `,
        [`TMOL_DE_${row.tmdId}`, row.tmdId, row.deText],
      );
    }
    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          seeded_tmd_ids: unique.length,
          checksum: crypto.createHash("md5").update(JSON.stringify(unique)).digest("hex"),
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

run().catch((err) => {
  console.error("seed-multilingual-target-screens failed:", err.message);
  process.exit(1);
});
