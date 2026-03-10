const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { DATABASE_URL } = require("../config/environment");
const { reloadPool } = require("../config/db");

/**
 * List of database names that can be selected in the internal DB switcher UI.
 * Only the database name in the connection URL is changed when switching.
 */
const ALLOWED_DATABASES = [
  { id: "assetlifecycle", name: "assetLifecycle", description: "Asset Lifecycle" },
  { id: "hospitality", name: "hospitality", description: "Hospitality" },
  { id: "hospital", name: "hospital", description: "Hospital" },
  { id: "automobile", name: "automobile", description: "Automobile" },
  { id: "manufacturing", name: "manufacturing", description: "Manufacturing" },
];

/**
 * Parse database name from a DATABASE_URL string (e.g. postgresql://user:pass@host:5432/dbname => dbname)
 */
function parseDatabaseNameFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/(?:postgresql|postgres):\/\/[^/]+\/([^/?]+)/i);
  return match ? match[1].trim() : null;
}

/** Get current DB name from in-memory env (what the running process is using). */
function getCurrentDatabaseName() {
  return parseDatabaseNameFromUrl(DATABASE_URL);
}

/**
 * Read DATABASE_URL from .env file on disk and return the database name.
 * Use this so "Current" in the UI reflects the last saved choice (after switch), not the running process.
 */
function getCurrentDatabaseNameFromEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return null;
  try {
    const content = fs.readFileSync(envPath, "utf8");
    const lineMatch = content.match(/^\s*DATABASE_URL\s*=\s*(?:"([^"]*)"|(.+?))\s*$/m);
    const value = lineMatch
      ? (lineMatch[1] !== undefined ? lineMatch[1] : (lineMatch[2] || "").trim())
      : null;
    return parseDatabaseNameFromUrl(value);
  } catch {
    return null;
  }
}

/**
 * Build a new DATABASE_URL by replacing only the database name (path segment after last /).
 */
function buildNewDatabaseUrl(currentUrl, newDatabaseName) {
  if (!currentUrl || typeof currentUrl !== "string" || !newDatabaseName || typeof newDatabaseName !== "string") {
    return null;
  }
  const sanitized = newDatabaseName.trim().replace(/[/?&#\s]/g, "");
  if (!sanitized) return null;
  const match = currentUrl.match(/^(.*\/)([^/?]+)(\?.*)?$/);
  if (!match) return null;
  return match[1] + sanitized + (match[3] || "");
}

/**
 * Update .env file: set DATABASE_URL to newUrl. Preserves other lines and line endings.
 */
function updateEnvFile(newDatabaseUrl) {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env file not found");
  }
  let content = fs.readFileSync(envPath, "utf8");
  const linePattern = /^(\s*DATABASE_URL\s*=\s*).*$/m;
  if (!linePattern.test(content)) {
    throw new Error("DATABASE_URL not found in .env");
  }
  const escaped = newDatabaseUrl.includes(" ") || newDatabaseUrl.includes("#")
    ? `"${String(newDatabaseUrl).replace(/"/g, '\\"')}"`
    : newDatabaseUrl;
  content = content.replace(linePattern, `$1${escaped}`);
  fs.writeFileSync(envPath, content, "utf8");
}

/**
 * GET /api/internal/databases
 * Returns the list of databases available for the DB switcher.
 * Used by the internal Database Connection UI.
 */
router.get("/databases", (req, res) => {
  try {
    const current = getCurrentDatabaseNameFromEnvFile() ?? getCurrentDatabaseName();
    const list = ALLOWED_DATABASES.map((db) => ({
      id: db.id,
      name: db.name,
      description: db.description,
      isCurrent: current !== null && current.toLowerCase() === db.name.toLowerCase(),
    }));
    return res.json({ success: true, data: list });
  } catch (err) {
    console.error("[internal/databases]", err);
    return res.status(500).json({ success: false, message: "Failed to get databases list" });
  }
});

/**
 * GET /api/internal/current-database
 * Returns the current database name (from .env on disk so it matches the active pool after a switch).
 */
router.get("/current-database", (req, res) => {
  try {
    const current = getCurrentDatabaseNameFromEnvFile() ?? getCurrentDatabaseName();
    return res.json({ success: true, data: { currentDatabase: current } });
  } catch (err) {
    console.error("[internal/current-database]", err);
    return res.status(500).json({ success: false, message: "Failed to get current database" });
  }
});

/**
 * POST /api/internal/switch-database
 * Body: { databaseName: "assetLifecycle" }
 * Updates .env and reloads the DB pool so the backend uses the new database immediately (no restart).
 */
router.post("/switch-database", async (req, res) => {
  try {
    const databaseName = req.body?.databaseName;
    if (!databaseName || typeof databaseName !== "string") {
      return res.status(400).json({ success: false, message: "databaseName is required" });
    }
    const allowed = ALLOWED_DATABASES.find(
      (d) => d.name.toLowerCase() === databaseName.trim().toLowerCase()
    );
    if (!allowed) {
      return res.status(400).json({
        success: false,
        message: "Invalid database name. Must be one of: " + ALLOWED_DATABASES.map((d) => d.name).join(", "),
      });
    }
    const newUrl = buildNewDatabaseUrl(DATABASE_URL, allowed.name);
    if (!newUrl) {
      return res.status(500).json({ success: false, message: "Could not build new DATABASE_URL" });
    }
    updateEnvFile(newUrl);
    await reloadPool(newUrl);
    console.log("[internal/switch-database] Switched to database:", allowed.name);
    return res.json({
      success: true,
      message: "Database switched. The backend is now using the new database. Log out and log in again in the app.",
      data: { databaseName: allowed.name },
    });
  } catch (err) {
    console.error("[internal/switch-database]", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to switch database",
    });
  }
});

module.exports = router;
