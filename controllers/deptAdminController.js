const DeptAdminModel = require('../models/deptAdminModel');
const { v4: uuidv4 } = require("uuid");
const db = require('../config/db');
const { generateCustomId } = require("../utils/idGenerator");


// GET /departments
const fetchDepartments = async (req, res) => {
    try {
        const data = await DeptAdminModel.getAllDepartments();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

// GET /departments/:name/id
const fetchDeptIdByName = async (req, res) => {
    try {
        const { name } = req.params;
        const dept = await DeptAdminModel.getDepartmentIdByName(name);
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
        const admins = await DeptAdminModel.getAdminsByDeptId(dept_id);
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
        const users = await DeptAdminModel.getUsersByDeptId(dept_id);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

// POST /dept-admins
const createDeptAdmin = async (req, res) => {
    try {
        const { dept_id, user_id } = req.body;
        const org_id = req.user.org_id;
        const created_by = req.user.user_id;
        const ext_id = uuidv4();

        // Generate the next DPTA ID
        const idResult = await db.query(
            `SELECT id FROM "tblDeptAdmins" WHERE id LIKE 'DPTA%' ORDER BY id DESC LIMIT 1`
        );

       
        const newId = await generateCustomId("dept_admin", 2);

        // Insert into tblDeptAdmins
        const insertResult = await db.query(
            `INSERT INTO "tblDeptAdmins" (ext_id, id, org_id, dept_id, user_id, created_by, created_on)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
         RETURNING *`,
            [ext_id, newId, org_id, dept_id, user_id, created_by]
        );

        // 🔥 Update job_role_id in tblUsers to "admin/<dept_id>"
        const updatedRoleId = `admin/${dept_id}`;
        await db.query(
            `UPDATE "tblUsers" SET job_role_id = $1 WHERE user_id = $2`,
            [updatedRoleId, user_id]
        );

        res.status(201).json(insertResult.rows[0]);
    } catch (err) {
        console.error("Error creating department admin:", err);
        res.status(500).json({ error: "Failed to assign department admin" });
    }
  };

// DELETE /dept-admins
const deleteDeptAdmin = async (req, res) => {
    try {
        const { dept_id, user_id } = req.body;
        await DeptAdminModel.deleteDeptAdmin({ dept_id, user_id });
        res.status(200).json({ message: 'Admin removed successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete admin' });
    }
};

const fetchAllAdmins = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT d.dept_id, d.text AS dept_name, da.user_id, u.full_name
         FROM "tblDeptAdmins" da
         JOIN "tblUsers" u ON da.user_id = u.user_id
         JOIN "tblDepartments" d ON da.dept_id = d.dept_id`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Failed to fetch all admins:", err);
        res.status(500).json({ error: "Failed to fetch admins" });
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
