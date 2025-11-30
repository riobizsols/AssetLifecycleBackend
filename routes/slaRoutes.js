const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const slaController = require("../controllers/slaController");

// Apply authentication middleware to all routes
router.use(protect);

router.get("/sla-descriptions", slaController.getSLADescriptions);

module.exports = router;

