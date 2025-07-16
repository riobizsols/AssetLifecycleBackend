const express = require("express");
const router = express.Router();
const assetTypeController = require("../controllers/assetTypeController");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware
router.use(protect);

// POST /api/asset-types - Add new asset type
router.post("/asset-types", assetTypeController.addAssetType);

// GET /api/asset-types - Get all asset types
router.get("/asset-types", assetTypeController.getAllAssetTypes);

// GET /api/asset-types/:id - Get asset type by ID
router.get("/asset-types/:id", assetTypeController.getAssetTypeById);

// PUT /api/asset-types/:id - Update asset type
router.put("/asset-types/:id", assetTypeController.updateAssetType);

// DELETE /api/asset-types/:id - Delete asset type
router.delete("/asset-types/:id", assetTypeController.deleteAssetType);

module.exports = router;