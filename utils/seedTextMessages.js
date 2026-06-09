const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const FILE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

const MANUAL_DE_TRANSLATIONS = {
  "Failed to save": "Speichern fehlgeschlagen",
  Saved: "Gespeichert",
  "Failed to load translations": "Ubersetzungen konnten nicht geladen werden",
  "Failed to load text messages": "Textnachrichten konnten nicht geladen werden",
  "Please enter a lang code": "Bitte geben Sie einen Sprachcode ein",
  "Job updated": "Job aktualisiert",
  "JSON copied": "JSON kopiert",
  "Failed to copy": "Kopieren fehlgeschlagen",
  "Failed to fetch jobs": "Jobs konnten nicht geladen werden",
  "Failed to fetch job history": "Job-Verlauf konnte nicht geladen werden",
};

const MANUAL_EN_BY_TMD_ID = {
  TMD_FAILED_TO_CREATE_ASSET_67770EC0: "Failed to create asset",
  TMD_FAILED_TO_DELETE_ASSETS_846A8366: "Failed to delete assets",
  TMD_FAILED_TO_DELETE_ASSET_295BFB6A: "Failed to delete asset",
  TMD_FAILED_TO_SUBMIT_QSN_PRINT_REQUEST_39D8A39B: "Failed to submit QSN print request",
  TMD_FAILED_TO_UPDATE_ASSET_8578544F: "Failed to update asset",
  TMD_I18N_ASSETS_NOPERMISSIONTOADDASSETS_254881D6: "No permission to add assets",
  TMD_I18N_COMMON_EXPORTSUCCESS_0C579D38: "Export successful",
  TMD_I18N_VENDORS_FAILEDTOFETCHVENDORS_00D2C278: "Failed to fetch vendors",
  TMD_I18N_VENDORS_PLEASESAVEVENDORFIRST_4D3BFE9E: "Please save vendor first",
  TMD_I18N_VENDORS_SAVEFAILED_08205C99: "Save failed",
};

const DEFAULT_FRONTEND_SRC = path.join(
  __dirname,
  "..",
  "..",
  "AssetLifecycleWebFrontend",
  "src",
);

function getAllSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllSourceFiles(fullPath));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (FILE_EXTENSIONS.has(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

function slugifyMessage(text) {
  return text
    .replace(/\$\{[^}]+\}/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
}

function hashString(input) {
  let hash = 0;
  const str = String(input || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0").slice(0, 8);
}

function tmdIdFromText(text) {
  const slug = slugifyMessage(text) || "MESSAGE";
  const hash = hashString(text);
  const shortSlug = slug.slice(0, 52);
  return `TMD_${shortSlug}_${hash}`;
}

function flattenLocale(localeObj, prefix = "", out = {}) {
  if (!localeObj || typeof localeObj !== "object") return out;
  for (const [key, value] of Object.entries(localeObj)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenLocale(value, nextKey, out);
    } else if (typeof value === "string") {
      out[nextKey] = value;
    }
  }
  return out;
}

function loadLocaleMap(frontendSrc, langCode) {
  const filePath = path.join(frontendSrc, "i18n", "locales", `${langCode}.json`);
  if (!fs.existsSync(filePath)) return {};
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return flattenLocale(parsed);
}

function extractToastMessages(content) {
  const matches = [];
  const regex = /toast\.(success|error)\(\s*(['"`])([\s\S]*?)\2\s*[,)]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const raw = match[3]?.trim();
    if (!raw) continue;
    if (raw.includes("${")) continue;
    if (raw.includes(" + ")) continue;
    matches.push(raw.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'"));
  }

  return matches;
}

function resolveFallbackTextFromBlock(block, enLocale) {
  const literalFallback = block.match(/fallbackText\s*:\s*(['"`])([\s\S]*?)\1/);
  if (literalFallback) {
    return literalFallback[2].trim().replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

  const i18nDirect = block.match(/fallbackText\s*:\s*t\(\s*(['"`])([^'"`]+)\1/);
  if (i18nDirect) {
    return enLocale[i18nDirect[2]] || "";
  }

  const i18nFromExpression = block.match(/fallbackText\s*:[\s\S]*?\|\|\s*t\(\s*(['"`])([^'"`]+)\1/);
  if (i18nFromExpression) {
    return enLocale[i18nFromExpression[2]] || "";
  }

  const literalFromExpression = block.match(/fallbackText\s*:[\s\S]*?\|\|\s*(['"`])([\s\S]*?)\1/);
  if (literalFromExpression) {
    return literalFromExpression[2].trim().replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

  return "";
}

function extractBackendTextMessages(content, enLocale) {
  const rows = [];
  const callRegex = /showBackendTextToast\(\s*\{([\s\S]*?)\}\s*\)/g;
  let match;

  while ((match = callRegex.exec(content)) !== null) {
    const block = match[1] || "";
    const tmdMatch = block.match(/tmdId\s*:\s*(['"`])([^'"`]+)\1/);
    if (!tmdMatch) continue;

    const tmd_id = String(tmdMatch[2] || "").trim();
    if (!tmd_id) continue;

    const fallbackText = resolveFallbackTextFromBlock(block, enLocale);
    rows.push({
      tmd_id,
      text: fallbackText || MANUAL_EN_BY_TMD_ID[tmd_id] || tmd_id,
    });
  }

  return rows;
}

function collectTextMessagesFromFrontend(frontendSrc = DEFAULT_FRONTEND_SRC) {
  const files = getAllSourceFiles(frontendSrc);
  const enLocale = loadLocaleMap(frontendSrc, "en");
  const uniqueMessages = new Map();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const found = extractToastMessages(content);
    for (const msg of found) {
      if (!uniqueMessages.has(msg)) {
        uniqueMessages.set(msg, {
          text: msg,
          tmd_id: tmdIdFromText(msg),
        });
      }
    }

    const backendRows = extractBackendTextMessages(content, enLocale);
    for (const row of backendRows) {
      const existing = uniqueMessages.get(row.tmd_id);
      if (!existing) {
        uniqueMessages.set(row.tmd_id, row);
      } else if (
        existing.text === existing.tmd_id &&
        row.text &&
        row.text !== row.tmd_id
      ) {
        uniqueMessages.set(row.tmd_id, row);
      }
    }
  }

  return Array.from(uniqueMessages.values()).map((row) => {
    if (row.tmd_id) return row;
    return {
      text: row.text,
      tmd_id: tmdIdFromText(row.text),
    };
  });
}

async function upsertTextMessageRows(client, rows) {
  let defaultCount = 0;
  let translationCount = 0;

  for (const row of rows) {
    await client.query(
      `
        INSERT INTO "tblTextMessagesDefault" (tmd_id, text)
        VALUES ($1, $2)
        ON CONFLICT (tmd_id)
        DO UPDATE SET text = CASE
          WHEN "tblTextMessagesDefault".text = "tblTextMessagesDefault".tmd_id
          THEN EXCLUDED.text
          ELSE "tblTextMessagesDefault".text
        END;
      `,
      [row.tmd_id, row.text],
    );
    defaultCount += 1;

    const deText = MANUAL_DE_TRANSLATIONS[row.text] || row.text;
    const tmolId = `TMOL_DE_${row.tmd_id}`.slice(0, 80);

    await client.query(
      `
        INSERT INTO "tblTextMessagesOtherLangs" (tmol_id, tmd_id, text, lang_code)
        VALUES ($1, $2, $3, 'de')
        ON CONFLICT (tmd_id, lang_code)
        DO UPDATE SET text = EXCLUDED.text;
      `,
      [tmolId, row.tmd_id, deText],
    );
    translationCount += 1;
  }

  return { defaultCount, translationCount };
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName],
  );
  return Boolean(result.rows[0]?.exists);
}

async function seedTextMessagesFromReference(client, genericUrl, logs = []) {
  if (!genericUrl) {
    return { defaultCount: 0, translationCount: 0, source: "reference", skipped: true };
  }

  const genericPool = new Pool({
    connectionString: genericUrl,
    max: 3,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  try {
    const hasDefaultTable = await tableExists(client, "tblTextMessagesDefault");
    const hasOtherTable = await tableExists(client, "tblTextMessagesOtherLangs");
    if (!hasDefaultTable || !hasOtherTable) {
      const message = "Text message tables are missing; skipped reference sync";
      console.warn(`[TextMessagesSeed] ${message}`);
      if (Array.isArray(logs)) {
        logs.push({ message, scope: "reference", level: "warning" });
      }
      return { defaultCount: 0, translationCount: 0, source: "reference", skipped: true };
    }

    const defaults = await genericPool.query(
      `SELECT tmd_id, text FROM "tblTextMessagesDefault" ORDER BY tmd_id`,
    );
    const translations = await genericPool.query(
      `SELECT tmol_id, tmd_id, text, lang_code FROM "tblTextMessagesOtherLangs" ORDER BY tmd_id, lang_code`,
    );

    if (defaults.rows.length === 0) {
      return { defaultCount: 0, translationCount: 0, source: "reference", skipped: true };
    }

    for (const row of defaults.rows) {
      await client.query(
        `
          INSERT INTO "tblTextMessagesDefault" (tmd_id, text)
          VALUES ($1, $2)
          ON CONFLICT (tmd_id) DO UPDATE SET text = EXCLUDED.text
        `,
        [row.tmd_id, row.text],
      );
    }

    for (const row of translations.rows) {
      await client.query(
        `
          INSERT INTO "tblTextMessagesOtherLangs" (tmol_id, tmd_id, text, lang_code)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (tmd_id, lang_code) DO UPDATE SET text = EXCLUDED.text
        `,
        [row.tmol_id, row.tmd_id, row.text, row.lang_code],
      );
    }

    const result = {
      defaultCount: defaults.rows.length,
      translationCount: translations.rows.length,
      source: "reference",
      skipped: false,
    };

    const message = `${result.defaultCount} default text messages and ${result.translationCount} translations synced from template database`;
    console.log(`[TextMessagesSeed] ${message}`);
    if (Array.isArray(logs)) {
      logs.push({ message, scope: "reference" });
    }

    return result;
  } finally {
    await genericPool.end();
  }
}

async function seedTextMessagesFromFrontend(client, frontendSrc = DEFAULT_FRONTEND_SRC, logs = []) {
  const hasDefaultTable = await tableExists(client, "tblTextMessagesDefault");
  const hasOtherTable = await tableExists(client, "tblTextMessagesOtherLangs");
  if (!hasDefaultTable || !hasOtherTable) {
    const message = "Text message tables are missing; skipped frontend seed";
    console.warn(`[TextMessagesSeed] ${message}`);
    if (Array.isArray(logs)) {
      logs.push({ message, scope: "reference", level: "warning" });
    }
    return { defaultCount: 0, translationCount: 0, source: "frontend", skipped: true };
  }

  const rows = collectTextMessagesFromFrontend(frontendSrc);
  if (rows.length === 0) {
    return { defaultCount: 0, translationCount: 0, source: "frontend", skipped: true };
  }

  const counts = await upsertTextMessageRows(client, rows);
  const message = `${counts.defaultCount} text messages seeded from frontend sources`;
  console.log(`[TextMessagesSeed] ${message}`);
  if (Array.isArray(logs)) {
    logs.push({ message, scope: "reference" });
  }

  return { ...counts, source: "frontend", skipped: false };
}

async function seedTextMessages(client, options = {}) {
  const {
    genericUrl = process.env.GENERIC_URL,
    frontendSrc = DEFAULT_FRONTEND_SRC,
    logs = [],
  } = options;

  try {
    const referenceResult = await seedTextMessagesFromReference(client, genericUrl, logs);
    if (referenceResult.defaultCount > 0) {
      return referenceResult;
    }
  } catch (error) {
    console.error("[TextMessagesSeed] Reference sync failed:", error.message);
    if (Array.isArray(logs)) {
      logs.push({
        message: `Text message reference sync failed: ${error.message}`,
        scope: "reference",
        level: "warning",
      });
    }
  }

  return seedTextMessagesFromFrontend(client, frontendSrc, logs);
}

module.exports = {
  collectTextMessagesFromFrontend,
  seedTextMessages,
  seedTextMessagesFromReference,
  seedTextMessagesFromFrontend,
  upsertTextMessageRows,
};
