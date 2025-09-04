const express = require("express");
const { fetchJobRoles, addJobRole } = require("../controllers/jobRoleController");
const { protect } = require('../middlewares/authMiddleware');


const router = express.Router();

router.get("/", protect, fetchJobRoles);
router.post("/", protect, addJobRole);

module.exports = router;
