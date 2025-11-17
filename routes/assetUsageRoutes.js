const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const assetUsageController = require("../controllers/assetUsageController");

router.get("/report/data", protect, assetUsageController.getUsageReport);
router.get("/report/filter-options", protect, assetUsageController.getUsageReportFilterOptions);
router.get("/report/export/csv", protect, assetUsageController.exportUsageReportCSV);
router.get("/report/export/pdf", protect, assetUsageController.exportUsageReportPDF);
router.get("/assets", protect, assetUsageController.getAssetsForUsageRecording);
router.get("/:assetId/history", protect, assetUsageController.getUsageHistory);
router.post("/", protect, assetUsageController.recordUsage);

module.exports = router;

