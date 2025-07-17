const userJobRoleModel = require("../models/userJobRoleModel");

// Get all user job roles
exports.getAllUserJobRoles = async (req, res) => {
    try {
        const userJobRoles = await userJobRoleModel.getAllUserJobRoles();
        res.json(userJobRoles);
    } catch (error) {
        console.error('Error fetching user job roles:', error);
        res.status(500).json({ 
            error: "Failed to fetch user job roles",
            details: error.message 
        });
    }
};

// Get user job role by ID
exports.getUserJobRoleById = async (req, res) => {
    const { user_job_role_id } = req.params;

    if (!user_job_role_id) {
        return res.status(400).json({ error: "user_job_role_id is required" });
    }

    try {
        const userJobRole = await userJobRoleModel.getUserJobRoleById(user_job_role_id);
        if (!userJobRole) {
            return res.status(404).json({ error: "User job role not found" });
        }
        res.json(userJobRole);
    } catch (error) {
        console.error('Error fetching user job role:', error);
        res.status(500).json({ error: "Failed to fetch user job role" });
    }
};

// Get user job roles by user_id
exports.getUserJobRolesByUserId = async (req, res) => {
    const { user_id } = req.params;

    if (!user_id) {
        return res.status(400).json({ error: "user_id is required" });
    }

    try {
        const userJobRoles = await userJobRoleModel.getUserJobRolesByUserId(user_id);
        res.json(userJobRoles);
    } catch (error) {
        console.error('Error fetching user job roles by user_id:', error);
        res.status(500).json({ error: "Failed to fetch user job roles" });
    }
};

// Get user job roles by job_role_id
exports.getUserJobRolesByJobRoleId = async (req, res) => {
    const { job_role_id } = req.params;

    if (!job_role_id) {
        return res.status(400).json({ error: "job_role_id is required" });
    }

    try {
        const userJobRoles = await userJobRoleModel.getUserJobRolesByJobRoleId(job_role_id);
        res.json(userJobRoles);
    } catch (error) {
        console.error('Error fetching user job roles by job_role_id:', error);
        res.status(500).json({ error: "Failed to fetch user job roles" });
    }
};

// Create new user job role
exports.createUserJobRole = async (req, res) => {
    const { user_job_role_id, user_id, job_role_id } = req.body;

    // Validation
    if (!user_job_role_id || !user_id || !job_role_id) {
        return res.status(400).json({ 
            error: "user_job_role_id, user_id, and job_role_id are required" 
        });
    }

    try {
        // Check if user job role already exists
        const exists = await userJobRoleModel.userJobRoleExists(user_job_role_id);
        if (exists) {
            return res.status(409).json({ error: "User job role already exists" });
        }

        // Check if user-job role combination already exists
        const combinationExists = await userJobRoleModel.userJobRoleCombinationExists(user_id, job_role_id);
        if (combinationExists) {
            return res.status(409).json({ error: "User-job role combination already exists" });
        }

        const newUserJobRole = await userJobRoleModel.createUserJobRole({
            user_job_role_id,
            user_id,
            job_role_id
        });

        res.status(201).json(newUserJobRole);
    } catch (error) {
        console.error('Error creating user job role:', error);
        res.status(500).json({ error: "Failed to create user job role" });
    }
};

// Update user job role
exports.updateUserJobRole = async (req, res) => {
    const { user_job_role_id } = req.params;
    const updateFields = req.body;

    if (!user_job_role_id) {
        return res.status(400).json({ error: "user_job_role_id is required" });
    }

    if (!Object.keys(updateFields).length) {
        return res.status(400).json({ error: "Update fields are required" });
    }

    // Validate that only allowed fields are being updated
    const allowedFields = ['user_id', 'job_role_id'];
    const invalidFields = Object.keys(updateFields).filter(field => !allowedFields.includes(field));
    
    if (invalidFields.length > 0) {
        return res.status(400).json({ 
            error: `Invalid fields: ${invalidFields.join(', ')}. Only user_id and job_role_id can be updated.` 
        });
    }

    try {
        // Check if user job role exists
        const exists = await userJobRoleModel.userJobRoleExists(user_job_role_id);
        if (!exists) {
            return res.status(404).json({ error: "User job role not found" });
        }

        // If updating user_id or job_role_id, check for duplicate combination
        if (updateFields.user_id || updateFields.job_role_id) {
            const current = await userJobRoleModel.getUserJobRoleById(user_job_role_id);
            const newUserId = updateFields.user_id || current.user_id;
            const newJobRoleId = updateFields.job_role_id || current.job_role_id;
            
            const combinationExists = await userJobRoleModel.userJobRoleCombinationExists(newUserId, newJobRoleId);
            if (combinationExists) {
                return res.status(409).json({ error: "User-job role combination already exists" });
            }
        }

        const updatedUserJobRole = await userJobRoleModel.updateUserJobRole(user_job_role_id, updateFields);
        if (!updatedUserJobRole) {
            return res.status(404).json({ error: "User job role not found or nothing updated" });
        }
        res.json(updatedUserJobRole);
    } catch (error) {
        console.error('Error updating user job role:', error);
        res.status(500).json({ error: "Failed to update user job role" });
    }
};

// Delete user job role by ID
exports.deleteUserJobRole = async (req, res) => {
    const { user_job_role_id } = req.params;

    if (!user_job_role_id) {
        return res.status(400).json({ error: "user_job_role_id is required" });
    }

    try {
        const deletedUserJobRole = await userJobRoleModel.deleteUserJobRole(user_job_role_id);
        if (!deletedUserJobRole) {
            return res.status(404).json({ error: "User job role not found" });
        }
        res.json({ message: "User job role deleted successfully", deletedUserJobRole });
    } catch (error) {
        console.error('Error deleting user job role:', error);
        res.status(500).json({ error: "Failed to delete user job role" });
    }
};

// Delete multiple user job roles
exports.deleteUserJobRoles = async (req, res) => {
    const { user_job_role_ids } = req.body;

    if (!Array.isArray(user_job_role_ids) || user_job_role_ids.length === 0) {
        return res.status(400).json({ error: "user_job_role_ids must be a non-empty array" });
    }

    try {
        const count = await userJobRoleModel.deleteUserJobRoles(user_job_role_ids);
        res.json({ message: `${count} user job role(s) deleted` });
    } catch (error) {
        console.error('Error deleting user job roles:', error);
        res.status(500).json({ error: "Failed to delete user job roles" });
    }
};

// Test endpoint to check if table exists
exports.testTableExists = async (req, res) => {
    try {
        const db = require('../config/db');
        const result = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'tblUserJobRoles'
            );
        `);
        
        const tableExists = result.rows[0].exists;
        
        if (tableExists) {
            // Try to get count of records
            const countResult = await db.query('SELECT COUNT(*) FROM "tblUserJobRoles"');
            const recordCount = countResult.rows[0].count;
            
            res.json({ 
                message: "Table exists", 
                tableExists: true, 
                recordCount: parseInt(recordCount) 
            });
        } else {
            res.json({ 
                message: "Table does not exist", 
                tableExists: false,
                suggestion: "Run the SQL script create_tblUserJobRoles.sql to create the table"
            });
        }
    } catch (error) {
        console.error('Error testing table existence:', error);
        res.status(500).json({ 
            error: "Failed to test table existence",
            details: error.message 
        });
    }
};
