const express = require("express");
const { fetchJobRoles, addJobRole } = require("../controllers/jobRoleController");
const { protect } = require('../middlewares/authMiddleware');


const router = express.Router();

router.get("/job-roles", protect, fetchJobRoles);
router.post("/job-roles", protect, addJobRole);

module.exports = router;
