const express = require("express");
const router = express.Router();
const controller = require("../controllers/assetScrapController");
const { authorize } = require("../middlewares/authorize");
const { protect } = require("../middlewares/authMiddleware");

// Public route for testing - Get all scrap assets
router.get("/", controller.getAllScrapAssets);

// Public route for testing - Get available assets by asset type
router.get("/available-by-type/:asset_type_id", controller.getAvailableAssetsByAssetType);



router.use(protect);

// GET /api/scrap-assets/:id - Get scrap asset by ID
router.get("/:id", controller.getScrapAssetById);

// POST /api/scrap-assets - Add new scrap asset
router.post("/", controller.addScrapAsset);

// PUT /api/scrap-assets/:id - Update scrap asset
router.put("/:id", controller.updateScrapAsset);

// DELETE /api/scrap-assets/:id - Delete scrap asset
router.delete("/:id", controller.deleteScrapAsset);

module.exports = router;
