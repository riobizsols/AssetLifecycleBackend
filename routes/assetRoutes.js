const express = require("express");
const router = express.Router();
const controller = require("../controllers/assetController");
const { authorize } = require("../middlewares/authorize");

router.get("/", controller.getAllAssets);
router.post("/", controller.addAsset);
router.put("/:asset_id", controller.updateAsset);
router.delete("/:asset_id", controller.deleteAsset);
router.post("/delete", controller.deleteMultipleAssets);
router.get("/potential-parents/:asset_type_id", controller.getPotentialParentAssets);

module.exports = router;
