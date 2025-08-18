const express = require("express");
const router = express.Router();
const controller = require("../controllers/scrapAssetsByTypeController");
const { authorize } = require("../middlewares/authorize");
const { protect } = require("../middlewares/authMiddleware");

// Public route for testing - Get all asset types with scrap assets
router.get("/asset-types/list", controller.getAssetTypesWithScrapAssets);

// Public route for testing - Get scrap assets by asset type
router.get("/:asset_type_id", controller.getScrapAssetsByAssetType);

// Protected routes (if needed in the future)
// router.use(protect);

// Example of protected route:
// router.get("/protected/:asset_type_id", authorize(['admin', 'manager']), controller.getScrapAssetsByAssetType);

module.exports = router;
