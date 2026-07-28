const DepartmentModel = require('../models/departmentModel');
const operationalCache = require('../utils/operationalCache');
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

        // Generate next dept_id from numeric max for this org (then bump sequence)
        const dbPool = req.db || require("../config/db");

        const maxResult = await dbPool.query(
            `SELECT COALESCE(MAX(
                CAST(SUBSTRING(dept_id FROM 4) AS INTEGER)
             ), 0) AS max_num
             FROM "tblDepartments"
             WHERE org_id = $1
               AND dept_id ~ '^DPT[0-9]+$'`,
            [org_id]
        );
        const maxNum = Number(maxResult.rows[0]?.max_num || 0);
        const newDeptId = `DPT${String(maxNum + 1).padStart(3, "0")}`;

        await dbPool.query(
            `INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
             VALUES ('department', 'DPT', $1)
             ON CONFLICT (table_key) DO UPDATE
             SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)`,
            [maxNum + 1]
        );

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
        operationalCache.invalidateOrgCaches(org_id).catch(() => {});
    } catch (err) {
        console.error("Error creating department:", err);
        res.status(500).json({ error: 'Failed to create department' });
    }
};

const getNextDepartmentId = async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const dbPool = req.db || require("../config/db");

        // Numeric max — lexicographic ORDER BY dept_id can mis-order once IDs exceed DPT999
        const result = await dbPool.query(
            `SELECT COALESCE(MAX(
                CAST(SUBSTRING(dept_id FROM 4) AS INTEGER)
             ), 0) AS max_num
             FROM "tblDepartments"
             WHERE org_id = $1
               AND dept_id ~ '^DPT[0-9]+$'`,
            [org_id]
        );

        const nextNum = Number(result.rows[0]?.max_num || 0) + 1;
        const nextDeptId = `DPT${String(nextNum).padStart(3, "0")}`;

        // Keep sequence table aligned so generateCustomId stays in sync
        await dbPool.query(
            `INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
             VALUES ('department', 'DPT', $1)
             ON CONFLICT (table_key) DO UPDATE
             SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)`,
            [result.rows[0]?.max_num || 0]
        );

        console.log('Next department ID:', nextDeptId);
        res.status(200).json({ nextDeptId });
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
        operationalCache.invalidateOrgCaches(req.user.org_id).catch(() => {});
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
        operationalCache.invalidateOrgCaches(req.user.org_id).catch(() => {});
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

        const { data: departments } = await operationalCache.cachedList(
            req,
            'departments',
            'list',
            () => DepartmentModel.getAllDepartments(org_id, branch_id, req.user?.hasSuperAccess || false),
        );
        res.status(200).json(departments);
    },
    deleteDepartment,
    updateDepartment,
    getNextDepartmentId
};
