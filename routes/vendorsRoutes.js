const express = require("express");
const router = express.Router();
const vendorsController = require("../controllers/vendorsController");

router.get("/get-vendors", vendorsController.getAllVendors);
router.get("/vendor-prod-services", vendorsController.getVendorProdServices);
router.post("/create-vendor", vendorsController.createVendor);
router.delete("/delete-vendor/:vendor_id", vendorsController.deleteVendor);
router.put("/update/:vendor_id", vendorsController.updateVendor);

module.exports = router;
