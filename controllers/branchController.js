const branchModel = require('../models/branchModel');
const { generateCustomId } = require("../utils/idGenerator");

const getBranches = async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const branches = await branchModel.getAllBranches(org_id);
        res.json(branches);
    } catch (error) {
        console.error("Error fetching branches:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

const createBranch = async (req, res) => {
    try {
        const { org_id, user_id } = req.user;
        const { text, city, branch_code } = req.body;

        // Fetch latest branch ID
        const newId = await generateCustomId("branch", 3); 

        const newBranch = await branchModel.addBranch({
            branch_id: newId,
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

const updateBranch = async (req, res) => {
    try {
        const { branch_id } = req.params;
        const { text, city, branch_code } = req.body;
        const { user_id } = req.user;

        // Validate required fields
        if (!text || !city || !branch_code) {
            return res.status(400).json({ 
                error: "Missing required fields",
                message: "Branch name, city and branch code are required" 
            });
        }

        // Check if branch exists
        const branches = await branchModel.getAllBranches();
        const branchExists = branches.find(b => b.branch_id === branch_id);
        
        if (!branchExists) {
            return res.status(404).json({ 
                error: "Branch not found",
                message: "The specified branch does not exist" 
            });
        }

        // Check if branch code is unique (excluding current branch)
        const duplicateBranchCode = branches.find(b => 
            b.branch_code === branch_code && b.branch_id !== branch_id
        );

        if (duplicateBranchCode) {
            return res.status(400).json({ 
                error: "Duplicate branch code",
                message: "This branch code is already in use" 
            });
        }

        const updatedBranch = await branchModel.updateBranch(
            branch_id,
            { text, city, branch_code },
            user_id
        );

        res.json({
            message: "Branch updated successfully",
            data: updatedBranch
        });
    } catch (error) {
        console.error("Error updating branch:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    getBranches,
    createBranch,
    deleteBranches,
    updateBranch,
};
