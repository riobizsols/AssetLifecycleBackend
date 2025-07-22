// routes/deptAssetRoutes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/deptAssetController");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);

router.get("/asset-types", controller.getAllAssetTypes);  // /api/dept-assets/asset-types
router.get("/", controller.fetchAllDeptAssets);           // /api/dept-assets/
router.post("/", controller.addDeptAsset);                // /api/dept-assets/
router.delete("/", controller.deleteDeptAsset);           // /api/dept-assets/

module.exports = router;
//dept asset route