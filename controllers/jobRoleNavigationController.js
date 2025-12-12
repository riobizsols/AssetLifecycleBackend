const {
    getAllNavigationEntries,
    createNavigationEntry,
    updateNavigationEntry,
    bulkCreateNavigationEntries
} = require("../models/jobRoleNavigationModel");
const { generateCustomId } = require("../utils/idGenerator");

/**
 * Get all job role navigation entries
 */
const getAllJobRoleNavigation = async (req, res) => {
    try {
        console.log("getAllJobRoleNavigation called, user:", req.user);
        const { org_id } = req.user;
        console.log("Fetching navigation for org_id:", org_id);
        const navigation = await getAllNavigationEntries(org_id);
        console.log("Navigation fetched successfully:", navigation.length);
        res.json({ navigation });
    } catch (error) {
        console.error("Error fetching job role navigation:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({ 
            message: "Failed to fetch navigation entries",
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * Create new job role navigation entry
 */
const addJobRoleNavigation = async (req, res) => {
    try {
        const { org_id, user_id } = req.user;
        const {
            job_role_id,
            app_id,
            label,
            access_level,
            is_group,
            mob_desk,
            sequence,
            parent_id
        } = req.body;

        if (!job_role_id || !app_id) {
            return res.status(400).json({ 
                message: "Missing required fields (job_role_id, app_id)" 
            });
        }

        // Auto-generate navigation ID
        const job_role_nav_id = await generateCustomId('job_role_nav', 3);
        console.log(`✅ Generated Navigation ID: ${job_role_nav_id}`);

        const newNav = await createNavigationEntry({
            job_role_nav_id,
            org_id,
            job_role_id,
            app_id,
            label: label || "",
            access_level: access_level || "D",
            is_group: is_group || false,
            mob_desk: mob_desk || "D",
            sequence: sequence || 1,
            parent_id: parent_id || null
        });

        res.status(201).json({ 
            message: "Navigation entry created successfully", 
            navigation: newNav 
        });
    } catch (error) {
        console.error("Error creating navigation entry:", error);
        
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({ message: "Navigation ID already exists" });
        }
        
        res.status(500).json({ 
            message: "Failed to create navigation entry",
            error: error.message 
        });
    }
};

/**
 * Update existing job role navigation entry
 */
const updateJobRoleNavigation = async (req, res) => {
    try {
        const { navId } = req.params;
        const { org_id, user_id } = req.user;
        const {
            job_role_id,
            app_id,
            label,
            access_level,
            is_group,
            mob_desk,
            sequence,
            parent_id,
            int_status
        } = req.body;

        const updatedNav = await updateNavigationEntry(navId, {
            job_role_id,
            app_id,
            label,
            access_level,
            is_group,
            mob_desk,
            sequence,
            parent_id,
            int_status: int_status !== undefined ? int_status : 1,
            changed_by: user_id
        }, org_id);

        if (!updatedNav) {
            return res.status(404).json({ message: "Navigation entry not found" });
        }

        res.json({ 
            message: "Navigation entry updated successfully", 
            navigation: updatedNav 
        });
    } catch (error) {
        console.error("Error updating navigation entry:", error);
        res.status(500).json({ 
            message: "Failed to update navigation entry",
            error: error.message 
        });
    }
};

/**
 * Bulk create job role navigation entries
 */
const bulkAddJobRoleNavigation = async (req, res) => {
    try {
        const { org_id, user_id } = req.user;
        const { entries } = req.body;

        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ 
                message: "Invalid request: 'entries' must be a non-empty array" 
            });
        }

        // Validate all entries
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry.job_role_id || !entry.app_id) {
                return res.status(400).json({ 
                    message: `Entry ${i + 1}: Missing required fields (job_role_id, app_id)` 
                });
            }
        }

        // Generate unique IDs for all entries
        const entriesWithIds = [];
        for (const entry of entries) {
            const job_role_nav_id = await generateCustomId('job_role_nav', 3);
            console.log(`✅ Generated Navigation ID: ${job_role_nav_id}`);
            
            entriesWithIds.push({
                job_role_nav_id,
                job_role_id: entry.job_role_id,
                app_id: entry.app_id,
                parent_id: entry.parent_id || null,
                label: entry.label || "",
                sequence: entry.sequence || 1,
                access_level: entry.access_level || "D",
                mob_desk: entry.mob_desk || "D",
                is_group: entry.is_group || false
            });
        }

        // Bulk insert with transaction
        const createdEntries = await bulkCreateNavigationEntries(entriesWithIds, org_id);

        res.status(201).json({ 
            message: `Successfully created ${createdEntries.length} navigation ${createdEntries.length === 1 ? 'entry' : 'entries'}`,
            navigation: createdEntries,
            count: createdEntries.length
        });
    } catch (error) {
        console.error("Error bulk creating navigation entries:", error);
        
        if (error.code === '23505') { // Unique constraint violation
            return res.status(409).json({ message: "One or more navigation IDs already exist" });
        }
        
        res.status(500).json({ 
            message: "Failed to create navigation entries",
            error: error.message 
        });
    }
};

module.exports = {
    getAllJobRoleNavigation,
    addJobRoleNavigation,
    updateJobRoleNavigation,
    bulkAddJobRoleNavigation
};

