const model = require("../models/assetGroupModel");

// POST /api/asset-groups - Create new asset group
const createAssetGroup = async (req, res) => {
    try {
        const { text, asset_ids } = req.body;

        // Get org_id and user_id from authenticated user
        const org_id = req.user.org_id;
        const created_by = req.user.user_id;

        // Validate required fields
        if (!text) {
            return res.status(400).json({ 
                error: "Group name (text) is required" 
            });
        }

        if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
            return res.status(400).json({ 
                error: "At least one asset must be selected" 
            });
        }

        // Create asset group with transaction
        const result = await model.createAssetGroup(org_id, text, asset_ids, created_by);

        res.status(201).json({
            message: "Asset group created successfully",
            asset_group: result
        });

    } catch (err) {
        console.error("Error creating asset group:", err);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
};

// GET /api/asset-groups - Get all asset groups
const getAllAssetGroups = async (req, res) => {
    try {
        const result = await model.getAllAssetGroups();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset groups:", err);
        res.status(500).json({ error: "Failed to fetch asset groups" });
    }
};

// GET /api/asset-groups/:id - Get asset group by ID
const getAssetGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getAssetGroupById(id);
        
        if (!result.header) {
            return res.status(404).json({ error: "Asset group not found" });
        }
        
        res.status(200).json(result);
    } catch (err) {
        console.error("Error fetching asset group:", err);
        res.status(500).json({ error: "Failed to fetch asset group" });
    }
};

// PUT /api/asset-groups/:id - Update asset group
const updateAssetGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { text, asset_ids } = req.body;
        const changed_by = req.user.user_id;

        // Validate required fields
        if (!text) {
            return res.status(400).json({ 
                error: "Group name (text) is required" 
            });
        }

        if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
            return res.status(400).json({ 
                error: "At least one asset must be selected" 
            });
        }

        // Check if asset group exists
        const existingGroup = await model.getAssetGroupById(id);
        if (!existingGroup.header) {
            return res.status(404).json({ error: "Asset group not found" });
        }

        // Update asset group
        const result = await model.updateAssetGroup(id, text, asset_ids, changed_by);

        res.status(200).json({
            message: "Asset group updated successfully",
            asset_group: result
        });

    } catch (err) {
        console.error("Error updating asset group:", err);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
};

// DELETE /api/asset-groups/:id - Delete asset group
const deleteAssetGroup = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if asset group exists
        const existingGroup = await model.getAssetGroupById(id);
        if (!existingGroup.header) {
            return res.status(404).json({ error: "Asset group not found" });
        }

        // Delete asset group
        const result = await model.deleteAssetGroup(id);

        res.status(200).json({
            message: "Asset group deleted successfully",
            deleted_group: result.rows[0]
        });

    } catch (err) {
        console.error("Error deleting asset group:", err);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
};

module.exports = {
    createAssetGroup,
    getAllAssetGroups,
    getAssetGroupById,
    updateAssetGroup,
    deleteAssetGroup
};
