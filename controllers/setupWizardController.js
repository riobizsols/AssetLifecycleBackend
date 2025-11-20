const setupWizardService = require("../services/setupWizardService");

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

module.exports = {
  testConnection,
  runSetup,
  getCatalog,
};

