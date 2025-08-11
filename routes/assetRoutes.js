const express = require("express");
const router = express.Router();
const controller = require("../controllers/assetController");
const { authorize } = require("../middlewares/authorize");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);
    
router.post("/", controller.addAsset);
router.post("/add", controller.createAsset); // web route

router.put("/:asset_id", controller.updateAsset);
router.delete("/:asset_id", controller.deleteAsset);
router.post("/delete", controller.deleteMultipleAssets);
router.get("/potential-parents/:asset_type_id", controller.getPotentialParentAssets);

router.get("/all-assets", controller.getAllAssets);
// GET /api/assets - Get all assets (with optional query filters)
router.get("/", controller.getAssetsWithFilters);

// GET /api/assets/:id - Get asset by ID
router.get("/:id", controller.getAssetById);  //......

// GET /api/assets/details/:id - Get asset with detailed information
// router.get("/details/:id", controller.getAssetWithDetails);

// GET /api/assets/type/:asset_type_id - Get assets by asset type
router.get("/type/:asset_type_id", controller.getAssetsByAssetType); //......

// GET /api/assets/type/:asset_type_id/inactive - Get inactive assets by asset type
router.get("/type/:asset_type_id/inactive", controller.getInactiveAssetsByAssetType); //.....

// GET /api/assets/branch/:branch_id - Get assets by branch
router.get("/branch/:branch_id", controller.getAssetsByBranch);

// GET /api/assets/vendor/:vendor_id - Get assets by vendor
router.get("/vendor/:vendor_id", controller.getAssetsByVendor);

// GET /api/assets/status/:status - Get assets by status
router.get("/status/:status", controller.getAssetsByStatus);

// GET /api/assets/serial/:serial_number - Get assets by serial number
router.get("/serial/:serial_number", controller.getAssetsBySerialNumber);

// GET /api/assets/expiring-30-days - Get assets expiring within 30 days
// router.get("/expiring-30-days", controller.getAssetsExpiringWithin30Days);

// GET /api/assets/expiry/:filterType - Get assets by expiry date with different filters
router.get("/expiry/:filterType", controller.getAssetsByExpiryDate);


// // GET /api/assets/org/:org_id - Get assets by organization
// router.get("/org/:org_id", controller.getAssetsByOrg);

// // GET /api/assets/search?q=searchTerm - Search assets
// router.get("/search", controller.searchAssets);

// DELETE /api/assets/:id - Delete single asset
router.delete("/:id", controller.deleteAsset);

// DELETE /api/assets - Delete multiple assets
router.delete("/", controller.deleteMultipleAssets);

module.exports = router;
