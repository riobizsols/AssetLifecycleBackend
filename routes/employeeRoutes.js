const express = require("express");
const router = express.Router();
const controller = require("../controllers/employeeController");
const bulkController = require("../controllers/employeeBulkUploadController");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/employees - Get all employees
router.get("/", controller.getAllEmployees);

// GET /api/employees/with-roles - Get all employees with their current job roles
router.get("/with-roles", controller.getAllEmployeesWithJobRoles);

// GET /api/employees/department/:dept_id - Get employees by department
router.get("/department/:dept_id", controller.getEmployeesByDepartment); 

// POST /api/employees/:emp_int_id/assign-role - Assign role to employee
router.post("/:emp_int_id/assign-role", controller.assignRoleToEmployee);

// User role management routes
// GET /api/employees/users/:user_id/roles - Get all roles for a specific user
router.get("/users/:user_id/roles", controller.getUserRoles);

// DELETE /api/employees/users/:user_id/roles/:user_job_role_id - Delete a specific role assignment
router.delete("/users/:user_id/roles/:user_job_role_id", controller.deleteUserRole);

// PUT /api/employees/users/:user_id/roles/:user_job_role_id - Update a specific role assignment
router.put("/users/:user_id/roles/:user_job_role_id", controller.updateUserRole);

// Bulk upload routes
router.post("/check-existing", bulkController.checkExistingEmployees);
router.post("/validate-bulk-upload", bulkController.validateBulkUploadEmployees);
router.post("/trial-upload", bulkController.trialUploadEmployees);
router.post("/commit-bulk-upload", bulkController.commitBulkUploadEmployees);

// GET /api/employees/:id - Get employee by ID (must be last to avoid conflicts)
router.get("/:id", controller.getEmployeeById);

module.exports = router;
