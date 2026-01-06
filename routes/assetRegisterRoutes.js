const express = require("express");
const router = express.Router();
const assetRegisterController = require("../controllers/assetRegisterController");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/asset-register - Get asset register data with filters
router.get("/", assetRegisterController.getAssetRegister);

// GET /api/asset-register/filter-options - Get filter options for dropdowns
router.get("/filter-options", assetRegisterController.getAssetRegisterFilterOptions);

// GET /api/asset-register/summary - Get asset register summary statistics
router.get("/summary", assetRegisterController.getAssetRegisterSummary);

// GET /api/asset-register/property-values/:propertyName - Get distinct values for a property
router.get("/property-values/:propertyName", assetRegisterController.getPropertyValues);

// GET /api/asset-register/asset-properties/:assetId - Get properties for a specific asset
router.get("/asset-properties/:assetId", assetRegisterController.getAssetProperties);

module.exports = router;
    