const express = require("express");
const router = express.Router();
const controller = require("../controllers/scrapSalesController");
const { authorize } = require("../middlewares/authorize");
const { protect } = require("../middlewares/authMiddleware");

// Public routes for testing
router.get("/", controller.getAllScrapSales);
router.get("/:id", controller.getScrapSaleById);
router.post("/validate-assets", controller.validateScrapAssetsForSale);

// Protected routes
router.use(protect);

// POST /api/scrap-sales - Create new scrap sale (requires authentication)
router.post("/", controller.createScrapSale);

// PUT /api/scrap-sales/:id - Update scrap sale (requires authentication)
router.put("/:id", controller.updateScrapSale);

// DELETE /api/scrap-sales/:id - Delete scrap sale (requires authentication)
router.delete("/:id", controller.deleteScrapSale);

// Example of role-based authorization (uncomment if needed)
// router.post("/", authorize(['admin', 'manager']), controller.createScrapSale);
// router.delete("/:id", authorize(['admin', 'manager']), controller.deleteScrapSale);

module.exports = router;
