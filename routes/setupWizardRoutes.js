const express = require("express");
const router = express.Router();
const {
  testConnection,
  runSetup,
  getCatalog,
  syncKeys,
} = require("../controllers/setupWizardController");

router.get("/catalog", getCatalog);
router.post("/test-connection", testConnection);
router.post("/run", runSetup);
router.post("/sync-keys", syncKeys);

module.exports = router;

