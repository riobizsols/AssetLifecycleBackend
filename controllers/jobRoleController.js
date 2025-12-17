const {
    getJobRolesByOrg,
    createJobRole,
    updateJobRoleById,
    getJobRoleByIdFromDb,
    getAllAppIds,
    getNavigationByJobRole,
    deleteNavigationByJobRole,
    insertNavigationForJobRole
} = require("../models/jobRoleModel");
const { generateCustomId } = require("../utils/idGenerator");

/**
 * Fetch all job roles for organization
 */
const fetchJobRoles = async (req, res) => {
    try {
        console.log("fetchJobRoles called, user:", req.user);
        const { org_id } = req.user;
        console.log("Fetching job roles for org_id:", org_id);
        const roles = await getJobRolesByOrg(org_id);
        console.log("Job roles fetched successfully:", roles.length);
        res.json({ roles });
    } catch (error) {
        console.error("Error fetching job roles:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ 
            message: "Failed to fetch job roles",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Get available App IDs for assignment
 */
const getAvailableAppIds = async (req, res) => {
    try {
        const appIds = await getAllAppIds();
        res.json({ appIds });
    } catch (error) {
        console.error("Error fetching app IDs:", error);
        res.status(500).json({ message: "Failed to fetch app IDs" });
    }
};

/**
 * Get specific job role by ID
 */
const getJobRoleById = async (req, res) => {
    try {
        const { jobRoleId } = req.params;
        const { org_id } = req.user;
        
        const role = await getJobRoleByIdFromDb(jobRoleId, org_id);
        
        if (!role) {
            return res.status(404).json({ message: "Job role not found" });
        }
        
        res.json({ role });
    } catch (error) {
        console.error("Error fetching job role:", error);
        res.status(500).json({ message: "Failed to fetch job role" });
    }
};

/**
 * Get navigation items for a specific job role
 */
const getJobRoleNavigation = async (req, res) => {
    try {
        const { jobRoleId } = req.params;
        const { org_id } = req.user;
        
        const navigation = await getNavigationByJobRole(jobRoleId, org_id);
        res.json({ navigation });
    } catch (error) {
        console.error("Error fetching job role navigation:", error);
        res.status(500).json({ message: "Failed to fetch navigation" });
    }
};

/**
 * Create new job role with navigation items
 */
const addJobRole = async (req, res) => {
    try {
        const { org_id, user_id } = req.user;
        const { text, job_function, navigationItems } = req.body;

        if (!text) {
            return res.status(400).json({ message: "Missing required fields (text)" });
        }

        // Auto-generate job role ID
        const job_role_id = await generateCustomId('job_role', 3);
        console.log(`✅ Generated Job Role ID: ${job_role_id}`);

        // Create the job role in tblJobRoles
        const newRole = await createJobRole({
            org_id,
            job_role_id,
            text,
            job_function: job_function || null,
            created_by: user_id
        });

        // Insert navigation items into tblJobRoleNav if provided
        if (navigationItems && navigationItems.length > 0) {
            await insertNavigationForJobRole(job_role_id, org_id, navigationItems, user_id);
        }

        res.status(201).json({ 
            message: "Job role created successfully", 
            role: newRole 
        });
    } catch (error) {
        console.error("Error creating job role:", error);
        
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({ message: "Job role ID already exists" });
        }
        
        res.status(500).json({ 
            message: "Failed to create job role",
            error: error.message 
        });
    }
};

/**
 * Update existing job role and navigation items
 */
const updateJobRole = async (req, res) => {
    try {
        const { jobRoleId } = req.params;
        const { org_id, user_id } = req.user;
        const { text, job_function, int_status, navigationItems } = req.body;

        if (!text) {
            return res.status(400).json({ message: "Role name (text) is required" });
        }

        // Update the job role in tblJobRoles
        const updatedRole = await updateJobRoleById(jobRoleId, {
            text,
            job_function: job_function || null,
            int_status: int_status !== undefined ? int_status : 1,
            changed_by: user_id
        }, org_id);

        if (!updatedRole) {
            return res.status(404).json({ message: "Job role not found" });
        }

        // Update navigation items if provided
        if (navigationItems) {
            // Delete existing navigation items for this role
            await deleteNavigationByJobRole(jobRoleId, org_id);
            
            // Insert new navigation items
            if (navigationItems.length > 0) {
                await insertNavigationForJobRole(jobRoleId, org_id, navigationItems, user_id);
            }
        }

        res.json({ 
            message: "Job role updated successfully", 
            role: updatedRole 
        });
    } catch (error) {
        console.error("Error updating job role:", error);
        res.status(500).json({ 
            message: "Failed to update job role",
            error: error.message 
        });
    }
};

module.exports = {
    fetchJobRoles,
    addJobRole,
    updateJobRole,
    getJobRoleById,
    getAvailableAppIds,
    getJobRoleNavigation
};