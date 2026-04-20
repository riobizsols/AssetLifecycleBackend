const setupWizardService = require("../services/setupWizardService");
const syncDatabaseKeysService = require("../services/syncDatabaseKeysService");

const testConnection = async (req, res) => {
  try {
    const dbConfig = req.body?.db || req.body;
    if (!dbConfig) {
      return res.status(400).json({
        success: false,
        message: "Database configuration is required.",
      });
    }
    const result = await setupWizardService.testConnection(dbConfig);
    return res.json(result);
  } catch (error) {
    console.error("[SetupWizard] Test connection failed:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to connect to database.",
    });
  }
};

const runSetup = async (req, res) => {
  try {
    const result = await setupWizardService.runSetup(req.body);
    return res.json(result);
  } catch (error) {
    console.error("[SetupWizard] Setup run failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Setup wizard failed.",
    });
  }
};

const getCatalog = (req, res) => {
  const catalog = setupWizardService.getCatalog();
  return res.json({
    success: true,
    data: catalog,
  });
};

const syncKeys = async (req, res) => {
  try {
    const dbConfig = req.body?.db || req.body;
    if (!dbConfig) {
      return res.status(400).json({
        success: false,
        message: "Database configuration is required.",
      });
    }

    // Validate required fields
    if (!dbConfig.host || !dbConfig.database || !dbConfig.user || !dbConfig.password) {
      return res.status(400).json({
        success: false,
        message: "Database configuration is incomplete. Required: host, database, user, password.",
      });
    }

    console.log("[SetupWizard] Starting database key synchronization...");
    const result = await syncDatabaseKeysService.syncDatabaseKeys(dbConfig);
    
    return res.json({
      success: result.success,
      message: result.message,
      logs: result.logs || [],
      summary: result.summary || {},
    });
  } catch (error) {
    console.error("[SetupWizard] Sync keys failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to synchronize database keys.",
    });
  }
};

module.exports = {
  testConnection,
  runSetup,
  getCatalog,
  syncKeys,
};

