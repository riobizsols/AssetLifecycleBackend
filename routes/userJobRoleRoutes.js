const express = require("express");
const router = express.Router();
const userJobRoleController = require("../controllers/userJobRoleController");

// GET routes
router.get("/test-table", userJobRoleController.testTableExists);
router.get("/get-all", userJobRoleController.getAllUserJobRoles);
router.get("/get-by-id/:user_job_role_id", userJobRoleController.getUserJobRoleById);
router.get("/get-by-user/:user_id", userJobRoleController.getUserJobRolesByUserId);
router.get("/get-by-job-role/:job_role_id", userJobRoleController.getUserJobRolesByJobRoleId);

// POST routes
router.post("/create", userJobRoleController.createUserJobRole);

// PUT routes
router.put("/update/:user_job_role_id", userJobRoleController.updateUserJobRole);

// DELETE routes
router.delete("/delete/:user_job_role_id", userJobRoleController.deleteUserJobRole);
router.delete("/delete-multiple", userJobRoleController.deleteUserJobRoles);

module.exports = router;
