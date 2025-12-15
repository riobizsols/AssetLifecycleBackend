const express = require("express");
const { 
  getAllJobRoleNavigation,
  addJobRoleNavigation,
  updateJobRoleNavigation,
  bulkAddJobRoleNavigation
} = require("../controllers/jobRoleNavigationController");
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Get all job role navigation entries
router.get("/", protect, getAllJobRoleNavigation);

// Bulk create job role navigation entries
router.post("/bulk", protect, bulkAddJobRoleNavigation);

// Create new job role navigation entry
router.post("/", protect, addJobRoleNavigation);

// Update existing job role navigation entry
router.put("/:navId", protect, updateJobRoleNavigation);

module.exports = router;
