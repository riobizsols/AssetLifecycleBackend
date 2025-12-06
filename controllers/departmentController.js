const DepartmentModel = require('../models/departmentModel');
const { generateCustomId } = require("../utils/idGenerator");

const createDepartment = async (req, res) => {
    try {
        const { text } = req.body;

        const org_id = req.user.org_id;
        const created_by = req.user.user_id;

        // Get user's branch information
        const userModel = require("../models/userModel");
        const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
        const userBranchId = userWithBranch?.branch_id;

        console.log('=== Department Creation Debug ===');
        console.log('User org_id:', org_id);
        console.log('User branch_id:', userBranchId);

        const int_status = 1;
        const parent_id = null;
        const changed_by = null;

        // Use user's branch_id instead of null
        const branch_id = userBranchId;

        // 🔹 Generate unique department id: DPT01, DPT02, ...  
        const dbPool = req.db || require("../config/db");
  
        const deptIdResult = await dbPool.query(
            "SELECT dept_id FROM \"tblDepartments\" WHERE org_id = $1 ORDER BY dept_id DESC LIMIT 1",
            [org_id]
        );

        let newDeptId;
        if (deptIdResult.rows.length > 0) {
            // Extract the numeric part from the last department ID
            const lastDeptId = deptIdResult.rows[0].dept_id;
            const match = lastDeptId.match(/\d+/);
            if (match) {
                const nextNum = parseInt(match[0]) + 1;
                newDeptId = `DPT${String(nextNum).padStart(3, "0")}`;
            } else {
                newDeptId = "DPT001";
            }
        } else {
            // No departments exist yet, start with DPT001
            newDeptId = "DPT001";
        }

        // 🔹 Create department
        const newDept = await DepartmentModel.createDepartment({
            org_id,
            dept_id: newDeptId,
            int_status,
            text,
            parent_id,
            branch_id,
            created_by,
            changed_by
        });

        res.status(201).json(newDept);
    } catch (err) {
        console.error("Error creating department:", err);
        res.status(500).json({ error: 'Failed to create department' });
    }
};

const getNextDepartmentId = async (req, res) => {
    try {
        const org_id = req.user.org_id;

        // Get the highest department ID for this organization
        const dbPool = req.db || require("../config/db");

        const result = await dbPool.query(
            "SELECT dept_id FROM \"tblDepartments\" WHERE org_id = $1 ORDER BY dept_id DESC LIMIT 1",
            [org_id]
        );

        let nextDeptId;
        if (result.rows.length > 0) {
            // Extract the numeric part from the last department ID
            const lastDeptId = result.rows[0].dept_id;
            const match = lastDeptId.match(/\d+/);
            if (match) {
                const nextNum = parseInt(match[0]) + 1;
                nextDeptId = `DPT${String(nextNum).padStart(3, "0")}`;
            } else {
                nextDeptId = "DPT001";
            }
        } else {
            // No departments exist yet, start with DPT001
            nextDeptId = "DPT001";
        }

        console.log('Next department ID:', nextDeptId);

        res.status(200).json({ nextDeptId: nextDeptId });
    } catch (err) {
        console.error('Error getting next dept_id:', err);
        res.status(500).json({ error: 'Failed to fetch next department ID' });
    }
};



const deleteDepartment = async (req, res) => {
    try {
        const { departments } = req.body; // array of { org_id, dept_id }

        if (!departments || departments.length === 0) {
            return res.status(400).json({ error: "No departments provided" });
        }

        for (const dept of departments) {
            await DepartmentModel.deleteDepartment(dept.org_id, dept.dept_id);
        }

        res.status(200).json({ message: "Departments deleted successfully" });
    } catch (err) {
        console.error("Error deleting departments:", err);
        
        // Handle foreign key constraint errors
        if (err.message && err.message.includes('Cannot delete department')) {
            return res.status(400).json({ 
                error: "Cannot delete department",
                message: err.message,
                hint: "You must first reassign or delete all employees associated with this department before it can be deleted"
            });
        }
        
        // Handle PostgreSQL foreign key constraint errors
        if (err.code === '23503') {
            return res.status(400).json({ 
                error: "Cannot delete department",
                message: "This department is being used by existing employees",
                hint: "You must first reassign or delete all employees associated with this department before it can be deleted"
            });
        }
        
        res.status(500).json({ error: "Failed to delete departments" });
    }
  };

const updateDepartment = async (req, res) => {
    try {
        const { dept_id, text } = req.body;

        const org_id = req.user.org_id;
        const changed_by = req.user.user_id;

        if (!dept_id || !text?.trim()) {
            return res.status(400).json({ error: "Missing dept_id or text" });
        }

        const updatedDept = await DepartmentModel.updateDepartment({
            dept_id,
            org_id,
            text,
            changed_by
        });

        if (!updatedDept) {
            return res.status(404).json({ error: "Department not found or not updated" });
        }

        res.status(200).json({ message: "Department updated successfully", department: updatedDept });
    } catch (err) {
        console.error("Error updating department:", err);
        res.status(500).json({ error: "Failed to update department" });
    }
};



module.exports = {
    createDepartment,
    getAllDepartments: async (req, res) => {
        const org_id = req.user.org_id;
        const branch_id = req.user.branch_id;   

        const departments = await DepartmentModel.getAllDepartments(org_id, branch_id, req.user?.hasSuperAccess || false);
        res.status(200).json(departments);
    },
    deleteDepartment,
    updateDepartment,
    getNextDepartmentId
};
