const express = require("express");
const { 
  getAllJobRoleNavigation,
  addJobRoleNavigation,
  updateJobRoleNavigation,
  bulkAddJobRoleNavigation,
  deleteJobRoleNavigation
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

// Delete navigation entries (bulk)
router.delete("/", protect, deleteJobRoleNavigation);

module.exports = router;
