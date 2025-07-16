const model = require("../models/assetTypeModel");
const { generateCustomId } = require("../utils/idGenerator");

// POST /api/asset-types - Add new asset type
const addAssetType = async (req, res) => {
    try {
        const {
            ext_id,
            org_id,
            asset_type_id, // Allow manual asset_type_id
            int_status = 1,
            maintenance_schedule,
            assignment_type,
            inspection_required = false,
            group_required = false,
            text
        } = req.body;

        const created_by = req.user.user_id;

        // Validate required fields
        if (!ext_id || !org_id || !text) {
            return res.status(400).json({ 
                error: "ext_id, org_id, and text are required fields" 
            });
        }

        // Validate ext_id is a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(ext_id)) {
            return res.status(400).json({ 
                error: "ext_id must be a valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)" 
            });
        }

        // Check if asset type already exists
        const existingAsset = await model.checkAssetTypeExists(ext_id, org_id);
        if (existingAsset.rows.length > 0) {
            return res.status(409).json({ 
                error: "Asset type with this ext_id and org_id already exists" 
            });
        }

        // Use provided asset_type_id or generate one
        let finalAssetTypeId = asset_type_id;
        if (!asset_type_id) {
            finalAssetTypeId = await generateCustomId("asset_type", 3);
        } else {
            // Check if the provided asset_type_id already exists
            const existingAssetType = await model.getAssetTypeById(asset_type_id);
            if (existingAssetType.rows.length > 0) {
                return res.status(409).json({ 
                    error: "Asset type with this asset_type_id already exists" 
                });
            }
        }

        // Insert new asset type
        const result = await model.insertAssetType(
            ext_id,
            org_id,
            finalAssetTypeId,
            int_status,
            maintenance_schedule,
            assignment_type,
            inspection_required,
            group_required,
            created_by,
            text
        );

        res.status(201).json({
            message: "Asset type added successfully",
            asset_type: result.rows[0]
        });

    } catch (err) {
        console.error("Error adding asset type:", err);
        res.status(500).json({ error: "Internal server error", err });
    }
};

// GET /api/asset-types - Get all asset types
const getAllAssetTypes = async (req, res) => {
    try {
        const result = await model.getAllAssetTypes();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset types:", err);
        res.status(500).json({ error: "Failed to fetch asset types" });
    }
};

// GET /api/asset-types/:id - Get asset type by ID
const getAssetTypeById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getAssetTypeById(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset type not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching asset type:", err);
        res.status(500).json({ error: "Failed to fetch asset type" });
    }
};

// PUT /api/asset-types/:id - Update asset type
const updateAssetType = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            ext_id,
            org_id,
            int_status,
            maintenance_schedule,
            assignment_type,
            inspection_required,
            group_required,
            text
        } = req.body;

        const changed_by = req.user.user_id;

        // Check if asset type exists
        const existingAsset = await model.getAssetTypeById(id);
        if (existingAsset.rows.length === 0) {
            return res.status(404).json({ error: "Asset type not found" });
        }

        // Check if new ext_id and org_id combination already exists (excluding current record)
        if (ext_id && org_id) {
            const duplicateCheck = await model.checkAssetTypeExists(ext_id, org_id);
            const duplicate = duplicateCheck.rows.find(row => row.asset_type_id !== id);
            if (duplicate) {
                return res.status(409).json({ 
                    error: "Asset type with this ext_id and org_id already exists" 
                });
            }
        }

        const updateData = {
            ext_id: ext_id || existingAsset.rows[0].ext_id,
            org_id: org_id || existingAsset.rows[0].org_id,
            int_status: int_status !== undefined ? int_status : existingAsset.rows[0].int_status,
            maintenance_schedule: maintenance_schedule || existingAsset.rows[0].maintenance_schedule,
            assignment_type: assignment_type || existingAsset.rows[0].assignment_type,
            inspection_required: inspection_required !== undefined ? inspection_required : existingAsset.rows[0].inspection_required,
            group_required: group_required !== undefined ? group_required : existingAsset.rows[0].group_required,
            text: text || existingAsset.rows[0].text
        };

        const result = await model.updateAssetType(id, updateData, changed_by);

        res.status(200).json({
            message: "Asset type updated successfully",
            asset_type: result.rows[0]
        });

    } catch (err) {
        console.error("Error updating asset type:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// DELETE /api/asset-types/:id - Delete asset type
const deleteAssetType = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if asset type exists
        const existingAsset = await model.getAssetTypeById(id);
        if (existingAsset.rows.length === 0) {
            return res.status(404).json({ error: "Asset type not found" });
        }

        await model.deleteAssetType(id);

        res.status(200).json({ message: "Asset type deleted successfully" });

    } catch (err) {
        console.error("Error deleting asset type:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

module.exports = {
    addAssetType,
    getAllAssetTypes,
    getAssetTypeById,
    updateAssetType,
    deleteAssetType
};
