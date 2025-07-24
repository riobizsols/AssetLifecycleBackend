const express = require("express");
const router = express.Router();
const controller = require("../controllers/employeeController");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

// GET /api/employees - Get all employees
router.get("/", controller.getAllEmployees);

// GET /api/employees/:id - Get employee by ID
router.get("/:id", controller.getEmployeeById);

// GET /api/employees/department/:dept_id - Get employees by department
router.get("/department/:dept_id", controller.getEmployeesByDepartment);

module.exports = router;
