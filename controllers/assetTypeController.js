const model = require("../models/assetTypeModel");
const { generateCustomId } = require("../utils/idGenerator");
const { v4: uuidv4 } = require('uuid');

// POST /api/asset-types - Add new asset type
const addAssetType = async (req, res) => {
    try {
        const {
            text,                   // from frontend
            assignment_type,        // from frontend
            int_status,            // from frontend (1 or 0)
            group_required,        // from frontend
            inspection_required,    // from frontend
            maintenance_schedule   // from frontend (1 or 0)
        } = req.body;

        // Get org_id and user_id from authenticated user
        const org_id = req.user.org_id;
        const created_by = req.user.user_id;

        // Generate ext_id (UUID)
        const ext_id = uuidv4();

        // Generate unique asset_type_id
        const asset_type_id = await generateCustomId("asset_type", 3);

        // Validate required fields
        if (!text) {
            return res.status(400).json({ 
                error: "Asset type name (text) is required" 
            });
        }

        // Insert new asset type
        const result = await model.insertAssetType(
            ext_id,
            org_id,
            asset_type_id,
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
        res.status(500).json({ error: "Internal server error", details: err.message });
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
        console.log('Received delete request for asset type ID:', id);

        // Check if asset type exists
        const existingAsset = await model.getAssetTypeById(id);
        console.log('Existing asset check result:', existingAsset.rows);
        
        if (existingAsset.rows.length === 0) {
            console.log('Asset type not found:', id);
            return res.status(404).json({ 
                error: "Asset type not found",
                details: `No asset type found with ID: ${id}`
            });
        }

        // Check if asset type is being used by any assets or department assets
        const references = await model.checkAssetTypeReferences(id);
        console.log('Reference check result:', references);
        
        const totalReferences = references.assetCount + references.deptAssetCount;

        if (totalReferences > 0) {
            let errorDetails = [];
            if (references.assetCount > 0) {
                errorDetails.push(`${references.assetCount} asset${references.assetCount > 1 ? 's' : ''}`);
            }
            if (references.deptAssetCount > 0) {
                errorDetails.push(`${references.deptAssetCount} department asset${references.deptAssetCount > 1 ? 's' : ''}`);
            }

            console.log('Cannot delete - references found:', errorDetails);
            return res.status(400).json({ 
                error: "Cannot delete this asset type as it is being used by existing records",
                details: `This asset type is referenced by ${errorDetails.join(' and ')}`,
                hint: "You must first reassign or delete all assets using this asset type before it can be deleted"
            });
        }

        // If no references exist, proceed with deletion
        console.log('Attempting to delete asset type:', id);
        const result = await model.deleteAssetType(id);
        console.log('Delete result:', result.rows);
        
        if (result.rows.length > 0) {
            res.status(200).json({ 
                message: "Asset type deleted successfully",
                deleted: result.rows[0]
            });
        } else {
            console.log('Delete failed - no rows affected');
            res.status(500).json({ 
                error: "Failed to delete asset type",
                details: "No rows were affected"
            });
        }

    } catch (err) {
        console.error("Error deleting asset type:", err);
        res.status(500).json({ 
            error: "Internal server error", 
            details: err.message,
            hint: err.code === '23503' ? "This asset type cannot be deleted because it is referenced by other records" : undefined
        });
    }
};

module.exports = {
    addAssetType,
    getAllAssetTypes,
    getAssetTypeById,
    updateAssetType,
    deleteAssetType
};
