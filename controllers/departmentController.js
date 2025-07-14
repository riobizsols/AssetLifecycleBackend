const db = require('../config/db');
const DepartmentModel = require('../models/departmentModel');
const { generateCustomId } = require("../utils/idGenerator");

const createDepartment = async (req, res) => {
    try {
        const { text } = req.body;

        const org_id = req.user.org_id;
        const created_by = req.user.user_id;

        const int_status = 1;
        const parent_id = null;
        const changed_by = null;

        // 🔹 Get ext_id from tblOrgs
        const orgResult = await db.query(
            'SELECT ext_id FROM "tblOrgs" WHERE org_id = $1',
            [org_id]
        );

        if (orgResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid org_id - not found in tblOrgs' });
        }

        const ext_id = orgResult.rows[0].ext_id;

      

        let branch_code = null;

        // 🔹 Generate unique department id: DPT01, DPT02, ...  
        const deptIdResult = await db.query(
            "SELECT dept_id FROM \"tblDepartments\" WHERE org_id = $1 ORDER BY dept_id DESC LIMIT 1",
            [org_id]
        );

        const newDeptId = await generateCustomId("department");

        // 🔹 Create department
        const newDept = await DepartmentModel.createDepartment({
            ext_id,
            org_id,
            dept_id: newDeptId,
            int_status,
            text,
            parent_id,
            branch_code,
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

        const result = await db.query(
            "SELECT dept_id FROM \"tblDepartments\" WHERE org_id = $1 ORDER BY dept_id DESC LIMIT 1",
            [org_id]
        );

        const newDeptId = await generateCustomId("department");

        console.log('Next department ID:', newDeptId);

        res.status(200).json({ nextDeptId: newDeptId });
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
        try {
            const departments = await DepartmentModel.getAllDepartments();
            res.status(200).json(departments);
        } catch (err) {
            console.error("Error fetching departments:", err);
            res.status(500).json({ error: 'Failed to fetch departments' });
        }
    },
    deleteDepartment,
    updateDepartment,
    getNextDepartmentId
};
