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

// Example of role-based authorization (uncomment if needed)
// router.post("/", authorize(['admin', 'manager']), controller.createScrapSale);

module.exports = router;
