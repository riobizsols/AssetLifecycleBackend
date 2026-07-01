const {
    getJobRolesByOrg,
    createJobRole,
    updateJobRoleById,
    getJobRoleByIdFromDb,
    getAllAppIds,
    getNavigationByJobRole,
    deleteNavigationByJobRole,
    insertNavigationForJobRole,
    deleteJobRolesByIds
} = require("../models/jobRoleModel");
const operationalCache = require('../utils/operationalCache');
const { generateCustomId } = require("../utils/idGenerator");

/**
 * Fetch all job roles for organization
 */
const fetchJobRoles = async (req, res) => {
    try {
        console.log("fetchJobRoles called, user:", req.user);
        const { org_id } = req.user;
        const { data: roles } = await operationalCache.cachedList(
            req,
            'job-roles',
            'list',
            () => getJobRolesByOrg(org_id),
        );
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
        const { text, job_function, navigationItems, notif_warranty, notif_scrap } = req.body;

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
            created_by: user_id,
            notif_warranty: !!notif_warranty,
            notif_scrap: !!notif_scrap
        });

        // Insert navigation items into tblJobRoleNav if provided
        if (navigationItems && navigationItems.length > 0) {
            await insertNavigationForJobRole(job_role_id, org_id, navigationItems, user_id);
        }

        operationalCache.invalidateOrgCaches(org_id).catch(() => {});

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
        const { text, job_function, int_status, navigationItems, notif_warranty, notif_scrap } = req.body;

        if (!text) {
            return res.status(400).json({ message: "Role name (text) is required" });
        }

        // Update the job role in tblJobRoles
        const updatedRole = await updateJobRoleById(jobRoleId, {
            text,
            job_function: job_function || null,
            int_status: int_status !== undefined ? int_status : 1,
            notif_warranty: !!notif_warranty,
            notif_scrap: !!notif_scrap,
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

        operationalCache.invalidateOrgCaches(org_id).catch(() => {});

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

/**
 * Delete one or more job roles
 */
const deleteJobRoles = async (req, res) => {
    try {
        const { org_id } = req.user;
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Invalid or empty 'ids' array" });
        }

        const deletedCount = await deleteJobRolesByIds(ids, org_id);
        operationalCache.invalidateOrgCaches(org_id).catch(() => {});
        res.json({ message: `${deletedCount} job role(s) deleted`, deletedCount });
    } catch (error) {
        console.error("Error deleting job roles:", error);
        if (error.code === 'ROLE_IN_USE') {
            return res.status(409).json({ message: error.message });
        }
        res.status(500).json({ message: "Failed to delete job roles", error: error.message });
    }
};

module.exports = {
    fetchJobRoles,
    addJobRole,
    updateJobRole,
    getJobRoleById,
    getAvailableAppIds,
    getJobRoleNavigation,
    deleteJobRoles
};