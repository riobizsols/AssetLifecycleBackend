const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const FRONTEND_ROOT = path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src");
const DE_FILE = path.join(FRONTEND_ROOT, "i18n", "locales", "de.json");
const EN_FILE = path.join(FRONTEND_ROOT, "i18n", "locales", "en.json");

const TARGET_FILES = [
  path.join(FRONTEND_ROOT, "pages", "Assets.jsx"),
  path.join(FRONTEND_ROOT, "components", "ContentBox.jsx"),
  path.join(FRONTEND_ROOT, "components", "assets", "AddAssetForm.jsx"),
  path.join(FRONTEND_ROOT, "components", "assets", "UpdateAssetModal.jsx"),
  path.join(FRONTEND_ROOT, "components", "assetAssignment", "AssetSelection.jsx"),
  path.join(FRONTEND_ROOT, "components", "assetAssignment", "AssetsDetail.jsx"),
  path.join(FRONTEND_ROOT, "components", "assetAssignment", "AssetAssignmentList.jsx"),
  path.join(FRONTEND_ROOT, "pages", "DepartmentWiseAssetAssignment.jsx"),
  path.join(FRONTEND_ROOT, "pages", "EmployeeWiseAssetAssignment.jsx"),
  path.join(FRONTEND_ROOT, "pages", "AssetType.jsx"),
  path.join(FRONTEND_ROOT, "components", "AddAssetType.jsx"),
  path.join(FRONTEND_ROOT, "components", "UpdateAssetTypeModal.jsx"),
  path.join(FRONTEND_ROOT, "pages", "CostCenterTransfer.jsx"),
  path.join(FRONTEND_ROOT, "pages", "masterData", "Departments.jsx"),
  path.join(FRONTEND_ROOT, "pages", "masterData", "DepartmentsAdmin.jsx"),
  path.join(FRONTEND_ROOT, "pages", "masterData", "DepartmentsAsset.jsx"),
  path.join(FRONTEND_ROOT, "components", "ScrapMaintenanceApprovalDetail.jsx"),
  path.join(FRONTEND_ROOT, "pages", "reports", "AssetValuation.jsx"),
  path.join(FRONTEND_ROOT, "pages", "masterData", "Branches.jsx"),
  path.join(FRONTEND_ROOT, "components", "AddBranch.jsx"),
];

const MANUAL_DE_BY_TMD = {
  TMD_ASSET_TRANSFERRED_SUCCESSFULLY_F35D7610: "Anlage erfolgreich uebertragen",
  TMD_FAILED_TO_TRANSFER_ASSET_B5F699B8: "Anlagenuebertragung fehlgeschlagen",
  TMD_FAILED_TO_PROCESS_SCANNED_ASSET_4FB5D632: "Verarbeitung der gescannten Anlage fehlgeschlagen",
  TMD_FAILED_TO_CREATE_DEPARTMENT_8A22D911: "Erstellen der Abteilung fehlgeschlagen",
  TMD_CANNOT_DELETE_DEPARTMENT_WITH_REASON_18D8A14C: "Abteilung kann nicht geloescht werden",
  TMD_FAILED_TO_DELETE_DEPARTMENT_CFB60274: "Loeschen der Abteilung fehlgeschlagen",
  TMD_FAILED_TO_UPDATE_DEPARTMENT_7D24C793: "Aktualisierung der Abteilung fehlgeschlagen",
  TMD_FAILED_TO_ADD_DEPARTMENT_ADMIN_A84D5E0E: "Hinzufuegen des Abteilungsadministrators fehlgeschlagen",
  TMD_FAILED_TO_REMOVE_DEPARTMENT_ADMIN_9156E962: "Entfernen des Abteilungsadministrators fehlgeschlagen",
  TMD_FAILED_TO_ADD_DEPARTMENT_ASSET_MAPPING_E18A82E9: "Hinzufuegen der Abteilungs-Anlagenzuordnung fehlgeschlagen",
  TMD_FAILED_TO_REMOVE_DEPARTMENT_ASSET_MAPPING_49A0783C: "Entfernen der Abteilungs-Anlagenzuordnung fehlgeschlagen",
  TMD_FAILED_TO_LOAD_SCRAP_WORKFLOW_326DCEC3: "Laden des Verschrottungs-Workflows fehlgeschlagen",
  TMD_APPROVING_SCRAP_IN_PROGRESS_3F395E78: "Verschrottung wird genehmigt...",
  TMD_SCRAP_APPROVED_SUCCESSFULLY_29930D4C: "Verschrottung erfolgreich genehmigt",
  TMD_FAILED_TO_APPROVE_SCRAP_1EA9E4DC: "Genehmigung der Verschrottung fehlgeschlagen",
  TMD_REJECTING_SCRAP_IN_PROGRESS_09A2E790: "Verschrottung wird abgelehnt...",
  TMD_SCRAP_REJECTED_SUCCESSFULLY_8EAD62F7: "Verschrottung erfolgreich abgelehnt",
  TMD_FAILED_TO_REJECT_SCRAP_505743B6: "Ablehnung der Verschrottung fehlgeschlagen",
  TMD_FAILED_TO_FETCH_ASSET_VALUATION_DATA_00BD2A3A: "Abruf der Anlagenbewertungsdaten fehlgeschlagen",
  TMD_FAILED_TO_UPDATE_BRANCH_0AD95E61: "Aktualisierung der Niederlassung fehlgeschlagen",
  TMD_FAILED_TO_DELETE_BRANCHES_CF3A7071: "Loeschen der Niederlassungen fehlgeschlagen",
  TMD_BRANCHES_EXPORTED_SUCCESSFULLY_498FC7C7: "Niederlassungen erfolgreich exportiert",
  TMD_FAILED_TO_EXPORT_BRANCHES_3E370899: "Export der Niederlassungen fehlgeschlagen",
  TMD_FAILED_TO_CREATE_BRANCH_7FF7841A: "Erstellen der Niederlassung fehlgeschlagen",
};

function flatten(obj, prefix = "", out = {}) {
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

function parseBlocks(content) {
  const out = [];
  const regex = /showBackendTextToast\(\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const block = m[1] || "";
    const tmd = block.match(/tmdId\s*:\s*['"`]([^'"`]+)['"`]/);
    if (!tmd) continue;
    const tmdId = tmd[1];
    const i18n = block.match(/fallbackText\s*:\s*t\(\s*['"`]([^'"`]+)['"`]/);
    const literal = block.match(/fallbackText\s*:\s*['"`]([\s\S]*?)['"`]/);
    out.push({
      tmdId,
      i18nKey: i18n ? i18n[1] : null,
      literalFallback: literal ? literal[1] : null,
    });
  }
  return out;
}

async function run() {
  const enMap = flatten(JSON.parse(fs.readFileSync(EN_FILE, "utf8")));
  const deMap = flatten(JSON.parse(fs.readFileSync(DE_FILE, "utf8")));
  const enToDe = new Map();
  for (const [k, enText] of Object.entries(enMap)) {
    if (!deMap[k]) continue;
    if (!enToDe.has(enText)) enToDe.set(enText, deMap[k]);
  }
  const rows = [];
  for (const file of TARGET_FILES) {
    if (!fs.existsSync(file)) continue;
    rows.push(...parseBlocks(fs.readFileSync(file, "utf8")));
  }

  const dedup = Array.from(new Map(rows.map((r) => [r.tmdId, r])).values());
  const planned = dedup
    .map((r) => {
      if (r.i18nKey && deMap[r.i18nKey]) return { tmdId: r.tmdId, deText: deMap[r.i18nKey] };
      if (MANUAL_DE_BY_TMD[r.tmdId]) return { tmdId: r.tmdId, deText: MANUAL_DE_BY_TMD[r.tmdId] };
      if (r.literalFallback && enToDe.has(r.literalFallback)) {
        return { tmdId: r.tmdId, deText: enToDe.get(r.literalFallback) };
      }
      return null;
    })
    .filter(Boolean);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const p of planned) {
      await client.query(
        `
          UPDATE "tblTextMessagesOtherLangs"
          SET text = $3
          WHERE tmd_id = $1
            AND lang_code = $2
        `,
        [p.tmdId, "de", p.deText],
      );
    }
    await client.query("COMMIT");

    const ids = planned.map((p) => p.tmdId);
    const verify = await client.query(
      `
        SELECT COUNT(*)::int AS english_copy_count
        FROM "tblTextMessagesDefault" d
        JOIN "tblTextMessagesOtherLangs" o
          ON o.tmd_id = d.tmd_id
         AND o.lang_code = 'de'
        WHERE d.tmd_id = ANY($1::text[])
          AND d.text = o.text
      `,
      [ids],
    );

    console.log(
      JSON.stringify(
        {
          target_tmd_ids: dedup.length,
          updated_de_rows_attempted: planned.length,
          still_same_as_english_in_target_set: verify.rows[0].english_copy_count,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error("fill-german failed:", e.message);
  process.exit(1);
});
