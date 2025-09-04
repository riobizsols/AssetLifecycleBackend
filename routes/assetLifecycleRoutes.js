const express = require("express");
const router = express.Router();
const assetLifecycleController = require("../controllers/assetLifecycleController");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/asset-lifecycle - Get asset lifecycle data with filters
router.get("/", assetLifecycleController.getAssetLifecycle);

// GET /api/asset-lifecycle/filter-options - Get filter options for dropdowns
router.get("/filter-options", assetLifecycleController.getAssetLifecycleFilterOptions);

// GET /api/asset-lifecycle/summary - Get asset lifecycle summary statistics
router.get("/summary", assetLifecycleController.getAssetLifecycleSummary);

module.exports = router;
