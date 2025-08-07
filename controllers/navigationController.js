const { getUserNavigation, getNavigationByJobRole, getAllNavigationItems, createNavigationItem, updateNavigationItem, deleteNavigationItem } = require('../models/jobRoleNavModel');
const { getUserJobRole, assignJobRoleToUser, updateUserJobRole, getAllUsersWithJobRoles } = require('../models/userJobRoleModel');

// Get user's navigation based on their job role
const getUserNavigationData = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const platform = req.query.platform; // Default to Desktop ('D'), can be 'M' for mobile
        
        const navigation = await getUserNavigation(user_id, platform);
        
        res.json({
            success: true,
            data: navigation,
            user_id: user_id,
            platform: platform
        });
    } catch (error) {
        console.error('Error fetching user navigation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch navigation data'
        });
    }
};

// Get navigation for a specific job role (admin function)
const getJobRoleNavigation = async (req, res) => {
    try {
        const { job_role_id } = req.params;
        const platform = req.query.platform || 'D'; // Default to Desktop ('D'), can be 'M' for mobile
        
        const navigation = await getNavigationByJobRole(job_role_id, platform);
        
        res.json({
            success: true,
            data: navigation,
            job_role_id: job_role_id,
            platform: platform
        });
    } catch (error) {
        console.error('Error fetching job role navigation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch job role navigation'
        });
    }
};

// Get all navigation items (admin function)
const getAllNavigation = async (req, res) => {
    try {
        const navigation = await getAllNavigationItems();
        
        res.json({
            success: true,
            data: navigation
        });
    } catch (error) {
        console.error('Error fetching all navigation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch navigation data'
        });
    }
};

// Create navigation item (admin function)
const createNavigation = async (req, res) => {
    try {
        const {
            job_role_id,
            parent_id,
            app_id,
            label,
            is_group,
            seq,
            access_level,
            mobile_desktop
        } = req.body;

        if (!job_role_id || !app_id || !label) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: job_role_id, app_id, label'
            });
        }

        const newItem = await createNavigationItem({
            job_role_id,
            parent_id,
            app_id,
            label,
            is_group: is_group || false,
            seq: seq || 10,
            access_level: access_level || 'D',
            mobile_desktop: mobile_desktop || 'D'
        });

        res.status(201).json({
            success: true,
            message: 'Navigation item created successfully',
            data: newItem
        });
    } catch (error) {
        console.error('Error creating navigation item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create navigation item'
        });
    }
};

// Update navigation item (admin function)
const updateNavigation = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            parent_id,
            app_id,
            label,
            is_group,
            seq,
            access_level,
            mobile_desktop
        } = req.body;

        const updatedItem = await updateNavigationItem(id, {
            parent_id,
            app_id,
            label,
            is_group,
            seq,
            access_level,
            mobile_desktop
        });

        if (!updatedItem) {
            return res.status(404).json({
                success: false,
                message: 'Navigation item not found'
            });
        }

        res.json({
            success: true,
            message: 'Navigation item updated successfully',
            data: updatedItem
        });
    } catch (error) {
        console.error('Error updating navigation item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update navigation item'
        });
    }
};

// Delete navigation item (admin function)
const deleteNavigation = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedItem = await deleteNavigationItem(id);

        if (!deletedItem) {
            return res.status(404).json({
                success: false,
                message: 'Navigation item not found'
            });
        }

        res.json({
            success: true,
            message: 'Navigation item deleted successfully',
            data: deletedItem
        });
    } catch (error) {
        console.error('Error deleting navigation item:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete navigation item'
        });
    }
};

// Get user's job role
const getUserJobRoleData = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const userJobRole = await getUserJobRole(user_id);
        
        if (!userJobRole) {
            return res.status(404).json({
                success: false,
                message: 'User job role not found'
            });
        }

        res.json({
            success: true,
            data: userJobRole
        });
    } catch (error) {
        console.error('Error fetching user job role:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user job role'
        });
    }
};

// Assign job role to user (admin function)
const assignJobRole = async (req, res) => {
    try {
        const { user_id, job_role_id } = req.body;
        const assigned_by = req.user.user_id;

        if (!user_id || !job_role_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: user_id, job_role_id'
            });
        }

        const assignment = await assignJobRoleToUser(user_id, job_role_id, assigned_by);

        res.status(201).json({
            success: true,
            message: 'Job role assigned successfully',
            data: assignment
        });
    } catch (error) {
        console.error('Error assigning job role:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign job role'
        });
    }
};

// Get all users with their job roles (admin function)
const getAllUsersJobRoles = async (req, res) => {
    try {
        const users = await getAllUsersWithJobRoles();
        
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users with job roles:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users with job roles'
        });
    }
};

module.exports = {
    getUserNavigationData,
    getJobRoleNavigation,
    getAllNavigation,
    createNavigation,
    updateNavigation,
    deleteNavigation,
    getUserJobRoleData,
    assignJobRole,
    getAllUsersJobRoles
}; 