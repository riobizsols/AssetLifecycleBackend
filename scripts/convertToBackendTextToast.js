const fs = require("fs");
const path = require("path");

const FRONTEND_SRC = path.join(__dirname, "..", "..", "AssetLifecycleWebFrontend", "src");
const REPORT_PATH = path.join(__dirname, "multilingual-implementation-report.json");
const FILE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function getAllSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllSourceFiles(fullPath));
      continue;
    }
    if (FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
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

function ensureShowBackendImport(content, filePath) {
  if (content.includes("showBackendTextToast")) return content;

  const srcRoot = FRONTEND_SRC;
  const rel = path
    .relative(path.dirname(filePath), path.join(srcRoot, "utils", "errorTranslation.js"))
    .replace(/\\/g, "/")
    .replace(/\.js$/, "");
  const importPath = rel.startsWith(".") ? rel : `./${rel}`;
  const importLine = `import { showBackendTextToast } from '${importPath}';\n`;

  const lines = content.split("\n");
  let insertAt = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i].trim();
    if (l.startsWith("import ")) {
      insertAt = i + 1;
    }
  }
  lines.splice(insertAt, 0, importLine.trimEnd());
  return lines.join("\n");
}

function convertToastLiterals(content, stats) {
  const regex = /toast\.(success|error)\(\s*(['"`])((?:\\.|(?!\2).)*)\2(\s*,[\s\S]*?)?\)/g;
  let changed = false;
  const convertedMessages = [];

  const updated = content.replace(regex, (match, type, quote, rawText, trailingArgs) => {
    const text = rawText
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'");
    if (!text.trim()) return match;
    if (text.includes("${")) return match;

    const tmdId = tmdIdFromText(text);
    convertedMessages.push({ tmdId, text, type });
    changed = true;
    stats.convertedCalls += 1;
    // If toast options are present, keep existing call to avoid behavioral changes.
    if (trailingArgs && trailingArgs.trim()) {
      return match;
    }
    return `showBackendTextToast({ toast, tmdId: '${tmdId}', fallbackText: ${quote}${rawText}${quote}, type: '${type}' })`;
  });

  return { updated, changed, convertedMessages };
}

function countToastCalls(content) {
  const m = content.match(/toast\.(success|error|loading)\(/g);
  return m ? m.length : 0;
}

function countBackendCalls(content) {
  const m = content.match(/showBackendTextToast\(/g);
  return m ? m.length : 0;
}

function run() {
  const files = getAllSourceFiles(FRONTEND_SRC).filter(
    (f) => !f.endsWith(path.join("utils", "errorTranslation.js")) && !f.endsWith(path.join("utils", "mlToastRuntime.js"))
  );

  const stats = {
    scannedFiles: files.length,
    changedFiles: 0,
    convertedCalls: 0,
    totalToastCallsBefore: 0,
    totalToastCallsAfter: 0,
    totalBackendCallsAfter: 0,
    changed: [],
    pendingFiles: [],
  };

  for (const filePath of files) {
    const original = fs.readFileSync(filePath, "utf8");
    stats.totalToastCallsBefore += countToastCalls(original);

    const { updated, changed, convertedMessages } = convertToastLiterals(original, stats);
    let next = updated;

    if (changed) {
      next = ensureShowBackendImport(next, filePath);
      fs.writeFileSync(filePath, next, "utf8");
      stats.changedFiles += 1;
      stats.changed.push({
        file: filePath,
        converted: convertedMessages.length,
        sample: convertedMessages.slice(0, 5),
      });
    }

    const finalContent = changed ? next : original;
    const remaining = countToastCalls(finalContent);
    stats.totalToastCallsAfter += remaining;
    stats.totalBackendCallsAfter += countBackendCalls(finalContent);
    if (remaining > 0) {
      stats.pendingFiles.push({ file: filePath, remainingToastCalls: remaining });
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(stats, null, 2), "utf8");
  console.log("Conversion completed.");
  console.log(`Scanned files: ${stats.scannedFiles}`);
  console.log(`Changed files: ${stats.changedFiles}`);
  console.log(`Converted calls: ${stats.convertedCalls}`);
  console.log(`Remaining toast calls: ${stats.totalToastCallsAfter}`);
  console.log(`Backend text calls now: ${stats.totalBackendCallsAfter}`);
  console.log(`Report: ${REPORT_PATH}`);
}

run();

