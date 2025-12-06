const DeptAdminModel = require('../models/deptAdminModel');
const { v4: uuidv4 } = require("uuid");
const { generateCustomId } = require("../utils/idGenerator");


// GET /departments
const fetchDepartments = async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const branch_id = req.user.branch_id;
        const data = await DeptAdminModel.getAllDepartments(org_id, branch_id, req.user?.hasSuperAccess || false);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

// GET /departments/:name/id
const fetchDeptIdByName = async (req, res) => {
    try {
        const { name } = req.params;
        const org_id = req.user.org_id;
        const branch_id = req.user.branch_id;
        
        console.log('=== Department ID by Name Debug ===');
        console.log('deptName:', name);
        console.log('User org_id:', org_id);
        console.log('User branch_id:', branch_id);
        
        const dept = await DeptAdminModel.getDepartmentIdByName(name, org_id, branch_id, req.user?.hasSuperAccess || false);
        if (!dept) return res.status(404).json({ error: 'Department not found' });
        res.json(dept);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching dept ID' });
    }
};

// GET /dept-admins/:dept_id
const fetchAdminsForDept = async (req, res) => {
    try {
        const { dept_id } = req.params;
        const org_id = req.user.org_id;
        const branch_id = req.user.branch_id;
        
        console.log('=== Department Admins Debug ===');
        console.log('dept_id:', dept_id);
        console.log('User org_id:', org_id);
        console.log('User branch_id:', branch_id);
        
        const admins = await DeptAdminModel.getAdminsByDeptId(dept_id, org_id, branch_id, req.user?.hasSuperAccess || false);
        res.json(admins);
    } catch (err) {
        console.error("Error fetching admins:", err); // log it
        res.status(500).json({ error: 'Failed to fetch admins' });
    }
};


// GET /dept-users/:dept_id
const fetchUsersForDept = async (req, res) => {
    try {
        const { dept_id } = req.params;
        const org_id = req.user.org_id;
        const branch_id = req.user.branch_id;
        
        console.log('=== Department Users Debug ===');
        console.log('dept_id:', dept_id);
        console.log('User org_id:', org_id);
        console.log('User branch_id:', branch_id);
        
        const users = await DeptAdminModel.getUsersByDeptId(dept_id, org_id, branch_id, req.user?.hasSuperAccess || false);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// POST /dept-admins
const createDeptAdmin = async (req, res) => {
    try {
        const { dept_id, user_id } = req.body;
        
        // Validation
        if (!dept_id || !user_id) {
            return res.status(400).json({ 
                error: "Missing required fields",
                message: "Both dept_id and user_id are required" 
            });
        }

        const org_id = req.user.org_id;
        const created_by = req.user.user_id;
        
        // Get user's branch information
        const userModel = require("../models/userModel");
        const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
        const userBranchId = userWithBranch?.branch_id;
        
        console.log('=== Department Admin Creation Debug ===');
        console.log('User org_id:', org_id);
        console.log('User branch_id:', userBranchId);

        // Use tenant database from request context (set by middleware)
        const dbPool = req.db || require("../config/db");

        // Check if user already exists as admin for this department
        const existingAdmin = await dbPool.query(
            `SELECT * FROM "tblDeptAdmins" WHERE dept_id = $1 AND user_id = $2`,
            [dept_id, user_id]
        );

        if (existingAdmin.rows.length > 0) {
            return res.status(400).json({ 
                error: "User already admin",
                message: "This user is already an admin for this department" 
            });
        }

        // Check if department exists and belongs to user's branch
        const deptCheck = await dbPool.query(
            `SELECT text FROM "tblDepartments" WHERE dept_id = $1 AND org_id = $2 AND branch_id = $3`,
            [dept_id, org_id, userBranchId]
        );

        if (deptCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: "Department not found",
                message: "The specified department does not exist in your branch" 
            });
        }

        // Check if user exists
        const userCheck = await dbPool.query(
            `SELECT full_name FROM "tblUsers" WHERE user_id = $1`,
            [user_id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ 
                error: "User not found",
                message: "The specified user does not exist" 
            });
        }

        // Generate the next dept_admin_id using idGenerator
        const newDeptAdminId = await generateCustomId("dept_admin", 2);

        // Insert into tblDeptAdmins with branch_id

        const insertResult = await dbPool.query(
            `INSERT INTO "tblDeptAdmins" (dept_admin_id, org_id, branch_id, dept_id, user_id, created_by, created_on)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
         RETURNING *`,
            [newDeptAdminId, org_id, userBranchId, dept_id, user_id, created_by]
        );

        // 🔥 Update job_role_id in tblUsers to "admin/<dept_id>"
        const updatedRoleId = `admin/${dept_id}`;
        await dbPool.query(
            `UPDATE "tblUsers" SET job_role_id = $1 WHERE user_id = $2`,
            [updatedRoleId, user_id]
        );

        res.status(201).json({
            message: "Department admin created successfully",
            data: insertResult.rows[0]
        });
    } catch (err) {
        console.error("Error creating department admin:", err);
        
        // Handle specific database errors
        if (err.code === '23505') { // Unique constraint violation
            return res.status(400).json({ 
                error: "Duplicate entry",
                message: "This user is already an admin for this department" 
            });
        }
        
        if (err.code === '23503') { // Foreign key constraint violation
            return res.status(400).json({ 
                error: "Invalid reference",
                message: "The specified department or user does not exist" 
            });
        }
        
        res.status(500).json({ 
            error: "Failed to assign department admin",
            message: "An internal server error occurred" 
        });
    }
};

// DELETE /dept-admins
const deleteDeptAdmin = async (req, res) => {
    try {
        const { dept_id, user_id } = req.body;
        
        // Validation
        if (!dept_id || !user_id) {
            return res.status(400).json({ 
                error: "Missing required fields",
                message: "Both dept_id and user_id are required" 
            });
        }

        // Check if admin exists before deleting
        const dbPool = req.db || require("../config/db");

        const existingAdmin = await dbPool.query(
            `SELECT * FROM "tblDeptAdmins" WHERE dept_id = $1 AND user_id = $2`,
            [dept_id, user_id]
        );

        if (existingAdmin.rows.length === 0) {
            return res.status(404).json({ 
                error: "Admin not found",
                message: "This user is not an admin for this department" 
            });
        }

        await DeptAdminModel.deleteDeptAdmin({ dept_id, user_id });
        
        // Reset job_role_id in tblUsers
        await dbPool.query(
            `UPDATE "tblUsers" SET job_role_id = NULL WHERE user_id = $1`,
            [user_id]
        );
        
        res.status(200).json({ 
            message: 'Admin removed successfully',
            data: { dept_id, user_id }
        });
    } catch (err) {
        console.error("Error deleting department admin:", err);
        res.status(500).json({ 
            error: 'Failed to delete admin',
            message: "An internal server error occurred"
        });
    }
};

const fetchAllAdmins = async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const branch_id = req.user.branch_id;
        
        console.log('=== All Department Admins Debug ===');
        console.log('User org_id:', org_id);
        console.log('User branch_id:', branch_id);
        
        const dbPool = req.db || require("../config/db");

        
        const result = await dbPool.query(
            `SELECT d.dept_id, d.text AS dept_name, da.user_id, u.full_name
             FROM "tblDeptAdmins" da
             JOIN "tblUsers" u ON da.user_id = u.user_id
             JOIN "tblDepartments" d ON da.dept_id = d.dept_id
             WHERE da.org_id = $1 
               AND (da.branch_id = $2 OR da.branch_id IS NULL)
               AND d.org_id = $1
             ORDER BY d.text, u.full_name`,
            [org_id, branch_id]
        );
        
        
        res.json(result.rows);
    } catch (err) {
        console.error("Failed to fetch all admins:", err);
        res.status(500).json({ 
            error: "Failed to fetch admins",
            message: "An internal server error occurred"
        });
    }
};
  

module.exports = {
    fetchDepartments,
    fetchDeptIdByName,
    fetchAdminsForDept,
    fetchUsersForDept,
    createDeptAdmin,
    deleteDeptAdmin,
    fetchAllAdmins,
};
