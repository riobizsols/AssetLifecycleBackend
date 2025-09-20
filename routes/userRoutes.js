const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const userJobRoleModel = require("../models/userJobRoleModel");
const { protect } = require("../middlewares/authMiddleware");

// Apply authentication middleware to all routes
router.use(protect);

router.get("/get-users", userController.getAllUsers);
router.delete("/delete-users", userController.deleteUsers);
router.put("/update-users/:user_id", userController.updateUser);

// GET /api/users/employee-roles/:emp_int_id - Get all roles for an employee
router.get("/employee-roles/:emp_int_id", async (req, res) => {
    try {
        const { emp_int_id } = req.params;
        console.log(`Fetching roles for emp_int_id: ${emp_int_id}`);
        
        const roles = await userJobRoleModel.getEmployeeJobRoles(emp_int_id);
        console.log(`Found ${roles.length} roles for employee ${emp_int_id}:`, roles);
        
        res.status(200).json(roles);
    } catch (error) {
        console.error("Error fetching employee roles:", error);
        console.error("Error details:", error.message);
        console.error("Stack trace:", error.stack);
        res.status(500).json({ 
            error: "Failed to fetch employee roles",
            details: error.message 
        });
    }
});

module.exports = router;
    