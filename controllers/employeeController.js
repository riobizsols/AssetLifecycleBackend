const model = require("../models/employeeModel");
const userJobRoleModel = require("../models/userJobRoleModel");
const { sendWelcomeEmail, sendRoleAssignmentEmail } = require("../utils/mailer");
const db = require("../config/db");

// Helper function to get organization name from employee's department
const getOrganizationNameFromEmployee = async (emp_int_id) => {
    try {
        const result = await db.query(`
            SELECT o.text as org_name 
            FROM "tblEmployees" e
            JOIN "tblDepartments" d ON e.dept_id = d.dept_id
            JOIN "tblOrgs" o ON d.org_id = o.org_id
            WHERE e.emp_int_id = $1
        `, [emp_int_id]);
        return result.rows[0]?.org_name || 'Organization';
    } catch (error) {
        console.error('Error fetching organization name from employee:', error);
        return 'Organization';
    }
};

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







// GET /api/employees/with-roles - Get all employees with their current job roles
const getAllEmployeesWithJobRoles = async (req, res) => {
    try {
        const result = await model.getAllEmployeesWithJobRoles();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching employees with job roles:", err);
        res.status(500).json({ error: "Failed to fetch employees with job roles" });
    }
};

// PUT /api/employees/:emp_int_id - Assign role to employee
const assignRoleToEmployee = async (req, res) => {
    try {
        const { emp_int_id } = req.params;
        const { job_role_ids } = req.body; // Changed to accept array of role IDs
        const assigned_by = req.user?.user_id || 'SYSTEM';

        if (!job_role_ids || !Array.isArray(job_role_ids) || job_role_ids.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: "job_role_ids array is required and must not be empty" 
            });
        }

        // Check if employee exists in tblUsers by emp_int_id
        const existingUser = await userJobRoleModel.checkEmployeeInUsers(emp_int_id);
        
        let user_id;
        let newUser = null; // Initialize newUser variable
        if (existingUser) {
            // Employee exists in tblUsers, use existing user_id
            user_id = existingUser.user_id;
            console.log(`Employee ${emp_int_id} already exists in tblUsers with user_id: ${user_id}`);
        } else {
            // Employee doesn't exist in tblUsers, create new user
            const org_id = req.user?.org_id;
            if (!org_id) {
                return res.status(400).json({
                    success: false,
                    error: "Organization ID is required to create user"
                });
            }
            newUser = await userJobRoleModel.createUserForEmployee(emp_int_id, null, assigned_by, org_id);
            user_id = newUser.user_id;
            console.log(`Created new user for employee ${emp_int_id} with user_id: ${user_id}`);
        }

        // Check for existing roles to avoid duplicates
        const existingRoles = await userJobRoleModel.getEmployeeJobRoles(emp_int_id);
        const existingRoleIds = existingRoles.map(role => role.job_role_id);
        
        // Filter out roles that are already assigned
        const newRoleIds = job_role_ids.filter(roleId => !existingRoleIds.includes(roleId));
        
        if (newRoleIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: "All selected roles are already assigned to this employee"
            });
        }

        // Assign all new roles to the user
        const roleAssignments = [];
        for (const job_role_id of newRoleIds) {
            const roleAssignment = await userJobRoleModel.assignJobRole(user_id, job_role_id, assigned_by);
            roleAssignments.push(roleAssignment);
        }

        // Get role details for email
        const roleDetails = await db.query(
            `SELECT job_role_id, text as job_role_name 
             FROM "tblJobRoles" 
             WHERE job_role_id = ANY($1)`,
            [newRoleIds]
        );

        // Get user details for email
        const userDetails = await db.query(
            `SELECT user_id, full_name, email 
             FROM "tblUsers" 
             WHERE user_id = $1`,
            [user_id]
        );

        // Get organization name from employee's department
        const orgName = await getOrganizationNameFromEmployee(emp_int_id);

        // Send response immediately
        res.status(200).json({
            success: true,
            message: `Successfully assigned ${roleAssignments.length} role(s)`,
            data: roleAssignments,
            assignedRoles: newRoleIds,
            skippedRoles: job_role_ids.filter(roleId => existingRoleIds.includes(roleId)),
            action: existingUser ? 'roles_added' : 'user_created_and_roles_added'
        });

        // Send email notification asynchronously (non-blocking)
        setImmediate(async () => {
            try {
                console.log('📧 Preparing to send email notification...');
                console.log('📧 Existing user:', existingUser);
                console.log('📧 User details:', userDetails.rows[0]);
                console.log('📧 Role details:', roleDetails.rows);
                console.log('📧 Organization name:', orgName);
                console.log('📧 New user object:', newUser);
                
                if (existingUser) {
                    // Existing user - send role assignment email
                    console.log('📧 Sending role assignment email...');
                    const emailResult = await sendRoleAssignmentEmail(userDetails.rows[0], roleDetails.rows, orgName);
                    console.log('📧 Role assignment email result:', emailResult);
                } else {
                    // New user - send welcome email with credentials and roles
                    console.log('📧 Sending welcome email...');
                    if (newUser && newUser.generatedPassword) {
                        const userData = {
                            ...userDetails.rows[0],
                            generatedPassword: newUser.generatedPassword
                        };
                        console.log('📧 User data for welcome email:', userData);
                        const emailResult = await sendWelcomeEmail(userData, roleDetails.rows, orgName);
                        console.log('📧 Welcome email result:', emailResult);
                    } else {
                        console.log('❌ No newUser or generatedPassword found, cannot send welcome email');
                    }
                }
            } catch (emailError) {
                console.error('❌ Email sending failed:', emailError);
                // Don't fail the request if email fails
            }
        });

    } catch (err) {
        console.error("Error assigning role to employee:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to assign role to employee" 
        });
    }
};

// GET /api/users/:user_id/roles - Get all roles for a specific user
const getUserRoles = async (req, res) => {
    try {
        const { user_id } = req.params;
        
        if (!user_id) {
            return res.status(400).json({
                success: false,
                error: "user_id is required"
            });
        }
        
        const roles = await userJobRoleModel.getUserRoles(user_id);
        
        res.status(200).json({
            success: true,
            data: roles
        });
    } catch (error) {
        console.error("Error fetching user roles:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch user roles"
        });
    }
};

// DELETE /api/users/:user_id/roles/:user_job_role_id - Delete a specific role assignment
const deleteUserRole = async (req, res) => {
    try {
        const { user_id, user_job_role_id } = req.params;
        const changed_by = req.user?.user_id || 'SYSTEM';
        
        if (!user_id || !user_job_role_id) {
            return res.status(400).json({
                success: false,
                error: "user_id and user_job_role_id are required"
            });
        }
        
        // Delete the role assignment
        const deletedRole = await userJobRoleModel.deleteUserRole(user_job_role_id);
        
        // Check if user has any remaining roles
        const roleCount = await userJobRoleModel.getUserRoleCount(user_id);
        
        if (roleCount === 0) {
            // Deactivate user if no roles left
            await userJobRoleModel.deactivateUser(user_id);
            console.log(`User ${user_id} deactivated - no roles remaining`);
        }
        
        res.status(200).json({
            success: true,
            message: "Role deleted successfully",
            data: deletedRole,
            userDeactivated: roleCount === 0
        });
    } catch (error) {
        console.error("Error deleting user role:", error);
        res.status(500).json({
            success: false,
            error: "Failed to delete user role"
        });
    }
};

// PUT /api/users/:user_id/roles/:user_job_role_id - Update a specific role assignment
const updateUserRole = async (req, res) => {
    try {
        const { user_id, user_job_role_id } = req.params;
        const { job_role_id } = req.body;
        const changed_by = req.user?.user_id || 'SYSTEM';
        
        if (!user_id || !user_job_role_id || !job_role_id) {
            return res.status(400).json({
                success: false,
                error: "user_id, user_job_role_id, and job_role_id are required"
            });
        }
        
        // Update the role assignment
        const updatedRole = await userJobRoleModel.updateUserRole(user_job_role_id, job_role_id);
        
        res.status(200).json({
            success: true,
            message: "Role updated successfully",
            data: updatedRole
        });
    } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update user role"
        });
    }
};

module.exports = {
    getAllEmployees,
    getEmployeeById,
    getEmployeesByDepartment,
    getAllEmployeesWithJobRoles,
    assignRoleToEmployee,
    getUserRoles,
    deleteUserRole,
    updateUserRole,
}; 