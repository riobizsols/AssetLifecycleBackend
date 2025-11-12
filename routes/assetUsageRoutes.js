const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const assetUsageController = require("../controllers/assetUsageController");

router.get("/assets", protect, assetUsageController.getAssetsForUsageRecording);
router.get("/:assetId/history", protect, assetUsageController.getUsageHistory);
router.post("/", protect, assetUsageController.recordUsage);

module.exports = router;

