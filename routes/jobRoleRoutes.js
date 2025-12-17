const express = require("express");
const { 
  fetchJobRoles, 
  addJobRole, 
  updateJobRole,
  getJobRoleById,
  getAvailableAppIds,
  getJobRoleNavigation,
  getAllJobRoleNavigation,
  addJobRoleNavigation,
  updateJobRoleNavigation
} = require("../controllers/jobRoleController");
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// Get all job roles
router.get("/", protect, fetchJobRoles);

// Get available app IDs for assignment
router.get("/available-app-ids", protect, getAvailableAppIds);

// Get specific job role by ID
router.get("/:jobRoleId", protect, getJobRoleById);

// Get navigation items for a specific job role
router.get("/:jobRoleId/navigation", protect, getJobRoleNavigation);

// Create new job role
router.post("/", protect, addJobRole);

// Update existing job role
router.put("/:jobRoleId", protect, updateJobRole);

module.exports = router;
