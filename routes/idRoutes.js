const express = require("express");
const router = express.Router();
const { getNextDeptId } = require("../controllers/idController");
const { protect } = require("../middlewares/authMiddleware");

router.use(protect);
router.get("/next-dept-id", getNextDeptId);

module.exports = router;
