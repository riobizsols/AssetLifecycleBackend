const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const vendorsController = require("../controllers/vendorsController");

// Apply authentication middleware to all routes
router.use(protect);

router.get("/get-vendors", vendorsController.getAllVendors);
router.get("/vendor/:vendorId", vendorsController.getVendorById);
router.get("/vendor-prod-services", vendorsController.getVendorProdServices);
router.post("/create-vendor", vendorsController.createVendor);
router.delete("/delete-vendors", vendorsController.deleteVendors);
router.delete("/delete-vendor/:vendor_id", vendorsController.deleteVendor);
router.put("/update/:vendor_id", vendorsController.updateVendor);

module.exports = router;
