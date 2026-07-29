const express = require("express");
const router = express.Router();
const controller = require("../controllers/vendorProdServiceController");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

// POST /api/vendor-prod-services - Add new vendor product service
router.post("/", controller.addVendorProdService);

// GET /api/vendor-prod-services - Get all vendor product services
router.get("/", controller.getAllVendorProdServices);

// Specific path segments MUST be registered before /:id
router.get("/details/:id", controller.getVendorProdServiceWithDetails);
router.get("/vendor/:vendor_id", controller.getVendorProdServicesByVendor);
router.get("/prod-serv/:prod_serv_id", controller.getVendorProdServicesByProdServ);
router.get("/org/:org_id", controller.getVendorProdServicesByOrg);
router.get("/check/:prod_serv_id", controller.checkVendorAssociations);

// GET /api/vendor-prod-services/:id - Get vendor product service by ID
router.get("/:id", controller.getVendorProdServiceById);

// PUT /api/vendor-prod-services/:id - Update vendor product service
router.put("/:id", controller.updateVendorProdService);

// DELETE /api/vendor-prod-services/:id - Delete single vendor product service
router.delete("/:id", controller.deleteVendorProdService);

// DELETE /api/vendor-prod-services - Delete multiple vendor product services
router.delete("/", controller.deleteMultipleVendorProdServices);

module.exports = router;
