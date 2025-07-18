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

// GET /api/vendor-prod-services/:id - Get vendor product service by ID
router.get("/:id", controller.getVendorProdServiceById);

// GET /api/vendor-prod-services/details/:id - Get vendor product service with details
router.get("/details/:id", controller.getVendorProdServiceWithDetails);

// GET /api/vendor-prod-services/vendor/:vendor_id - Get vendor product services by vendor
router.get("/vendor/:vendor_id", controller.getVendorProdServicesByVendor);

// GET /api/vendor-prod-services/prod-serv/:prod_serv_id - Get vendor product services by product service
router.get("/prod-serv/:prod_serv_id", controller.getVendorProdServicesByProdServ);

// GET /api/vendor-prod-services/org/:org_id - Get vendor product services by organization
router.get("/org/:org_id", controller.getVendorProdServicesByOrg);

// PUT /api/vendor-prod-services/:id - Update vendor product service
router.put("/:id", controller.updateVendorProdService);

// DELETE /api/vendor-prod-services/:id - Delete single vendor product service
router.delete("/:id", controller.deleteVendorProdService);

// DELETE /api/vendor-prod-services - Delete multiple vendor product services
router.delete("/", controller.deleteMultipleVendorProdServices);

module.exports = router; 