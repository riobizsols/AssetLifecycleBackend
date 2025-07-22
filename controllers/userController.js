const userModel = require("../models/userModel");

exports.getAllUsers = async (req, res) => {
    try {
        const users = await userModel.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
};

exports.deleteUsers = async (req, res) => {
    const { user_ids } = req.body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
        return res.status(400).json({ 
            error: "user_ids must be a non-empty array",
            code: "INVALID_INPUT"
        });
    }

    try {
        const count = await userModel.deleteUsers(user_ids);
        res.json({ message: `${count} user(s) deleted` });
    } catch (error) {
        console.error('Delete users error:', error);

        // Handle foreign key constraint violation
        if (error.code === '23503') {
            // Extract the user ID and table name from the error detail
            const userIdMatch = error.detail.match(/\((.*?)\)/);
            const tableMatch = error.detail.match(/table "([^"]+)"/);
            const userId = userIdMatch ? userIdMatch[1] : 'unknown';
            const table = tableMatch ? tableMatch[1] : error.table;

            let errorMessage = '';
            let actionRequired = '';

            // Provide specific guidance based on the affected table
            switch (table) {
                case 'tblDeptAdmins':
                    errorMessage = `User ${userId} is a Department Administrator`;
                    actionRequired = 'Remove their admin role from Department Settings first';
                    break;
                case 'tblAssets':
                    errorMessage = `User ${userId} has assigned assets`;
                    actionRequired = 'Reassign or remove their assets first';
                    break;
                case 'tblDeptAssets':
                    errorMessage = `User ${userId} is managing department assets`;
                    actionRequired = 'Transfer their asset management responsibilities first';
                    break;
                case 'tblVendors':
                    errorMessage = `User ${userId} is linked to vendor information`;
                    actionRequired = 'Update vendor contact details first';
                    break;
                default:
                    errorMessage = `User ${userId} has dependencies in ${table}`;
                    actionRequired = 'Remove all references to this user first';
            }

            return res.status(409).json({
                error: 'Cannot delete user due to existing dependencies',
                code: error.code,
                detail: error.detail,
                table: table,
                constraint: error.constraint,
                userId: userId,
                message: errorMessage,
                action: actionRequired,
                type: 'DEPENDENCY_ERROR'
            });
        }

        // Handle other database errors
        if (error.code) {
            return res.status(400).json({
                error: 'Database error occurred',
                code: error.code,
                detail: error.detail,
                type: 'DATABASE_ERROR'
            });
        }

        // Handle unexpected errors
        res.status(500).json({
            error: "An unexpected error occurred while deleting users",
            type: 'INTERNAL_ERROR'
        });
    }
};

exports.updateUser = async (req, res) => {
    const { user_id } = req.params;
    const updateFields = req.body;

    if (!user_id || !Object.keys(updateFields).length) {
        return res.status(400).json({ error: "user_id and update fields required" });
    }

    try {
        const updatedUser = await userModel.updateUser(user_id, updateFields);
        if (!updatedUser) {
            return res.status(404).json({ error: "User not found or nothing updated" });
        }
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: "Failed to update user" });
    }
};
