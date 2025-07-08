const branchModel = require('../models/branchModel');
const { generateCustomId } = require("../utils/idGenerator");

const getBranches = async (req, res) => {
    try {
        const branches = await branchModel.getAllBranches();
        res.json(branches);
    } catch (error) {
        console.error("Error fetching branches:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const createBranch = async (req, res) => {
    try {
        const { org_id, ext_id, user_id } = req.user;
        const { text, city, branch_code } = req.body;

        // Fetch latest branch ID
        const newId = await generateCustomId("branch", 2); 

        const newBranch = await branchModel.addBranch({
            id: newId,
            ext_id,
            org_id,
            text,
            city,
            branch_code,
            created_by: user_id,
        });

        res.status(201).json(newBranch);
    } catch (error) {
        console.error("Error creating branch:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const deleteBranches = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Invalid or empty 'ids' array" });
        }

        const deletedCount = await branchModel.deleteBranches(ids);
        res.json({ message: `${deletedCount} branch(es) deleted` });
    } catch (error) {
        console.error("Error deleting branches:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getBranches,
    createBranch,
    deleteBranches,
};
