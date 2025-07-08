// routes/idRoutes.js
const express = require("express");
const router = express.Router();
const { getNextDeptId } = require("../controllers/idController");

router.get("/next-dept-id", getNextDeptId);

module.exports = router;
