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
        return res.status(400).json({ error: "user_ids must be a non-empty array" });
    }

    try {
        const count = await userModel.deleteUsers(user_ids);
        res.json({ message: `${count} user(s) deleted` });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete users" });
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
