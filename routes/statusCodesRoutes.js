const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const statusCodesController = require("../controllers/statusCodesController");

router.use(protect);

// GET /api/status-codes
router.get("/", statusCodesController.getStatusCodes);

module.exports = router;

