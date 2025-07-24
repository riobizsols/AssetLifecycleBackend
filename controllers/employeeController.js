const model = require("../models/employeeModel");

// GET /api/employees - Get all employees
const getAllEmployees = async (req, res) => {
    try {
        const result = await model.getAllEmployees();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching employees:", err);
        res.status(500).json({ error: "Failed to fetch employees" });
    }
};

// GET /api/employees/:id - Get employee by ID
const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getEmployeeById(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Employee not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching employee:", err);
        res.status(500).json({ error: "Failed to fetch employee" });
    }
};



// GET /api/employees/department/:dept_id - Get employees by department
const getEmployeesByDepartment = async (req, res) => {
    try {
        const { dept_id } = req.params;
        const result = await model.getEmployeesByDepartment(dept_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching employees by department:", err);
        res.status(500).json({ error: "Failed to fetch employees by department" });
    }
};







module.exports = {
    getAllEmployees,
    getEmployeeById,
    getEmployeesByDepartment,
}; 