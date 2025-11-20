const express = require("express");
const router = express.Router();
const {
  testConnection,
  runSetup,
  getCatalog,
} = require("../controllers/setupWizardController");

router.get("/catalog", getCatalog);
router.post("/test-connection", testConnection);
router.post("/run", runSetup);

module.exports = router;

