const model = require("../models/assetTypeModel");
const { generateCustomId } = require("../utils/idGenerator");

// POST /api/asset-types - Add new asset type
const addAssetType = async (req, res) => {
    try {
        const {
            text,                   // from frontend
            assignment_type,        // from frontend
            int_status,            // from frontend (1 or 0)
            group_required,        // from frontend
            inspection_required,    // from frontend
            maint_required,        // from frontend (1 or 0)
            is_child = false,      // from frontend
            parent_asset_type_id = null,  // from frontend
            maint_type_id = null,  // from frontend
            maint_lead_type = null,  // from frontend
            depreciation_type = 'ND'  // from frontend
        } = req.body;

        // Get org_id and user_id from authenticated user
        const org_id = req.user.org_id;
        const created_by = req.user.user_id;

        // Generate unique asset_type_id
        let asset_type_id = await generateCustomId("asset_type", 3);

        // Validate required fields
        if (!text) {
            return res.status(400).json({ 
                error: "Asset type name (text) is required" 
            });
        }

        // Validate parent_asset_type_id if is_child is true
        if (is_child && !parent_asset_type_id) {
            return res.status(400).json({
                error: "Parent asset type ID is required when creating a child asset type"
            });
        }

        // Verify parent_asset_type_id exists and is not a child itself
        if (parent_asset_type_id) {
            const parentAssetType = await model.getAssetTypeById(parent_asset_type_id);
            if (parentAssetType.rows.length === 0) {
                return res.status(400).json({
                    error: "Parent asset type not found"
                });
            }
            if (parentAssetType.rows[0].is_child) {
                return res.status(400).json({
                    error: "Cannot set a child asset type as parent"
                });
            }
        }

        // Insert new asset type
        let result;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                result = await model.insertAssetType(
                    org_id,
                    asset_type_id,
                    int_status,
                    maint_required,
                    assignment_type,
                    inspection_required,
                    group_required,
                    created_by,
                    text,
                    is_child,
                    parent_asset_type_id,
                    maint_type_id,
                    maint_lead_type,
                    depreciation_type
                );
                break; // Success, exit the loop
            } catch (err) {
                if (err.code === '23505' && err.constraint === 'tblAssetType_UK' && retryCount < maxRetries - 1) {
                    // Duplicate key error, generate a new ID and retry
                    console.warn(`Duplicate asset_type_id ${asset_type_id}, generating new ID...`);
                    asset_type_id = await generateCustomId("asset_type", 3);
                    retryCount++;
                } else {
                    // Re-throw the error if it's not a duplicate key or we've exhausted retries
                    throw err;
                }
            }
        }

        // Check if result is defined
        if (!result || !result.rows || result.rows.length === 0) {
            throw new Error('Failed to create asset type');
        }

        // Handle property mapping if properties are provided
        const { properties } = req.body;
        console.log('🔍 Properties received:', properties);
        console.log('🔍 Properties type:', typeof properties);  
        console.log('🔍 Is array:', Array.isArray(properties));
        console.log('🔍 Length:', properties?.length);
        
        if (properties && Array.isArray(properties) && properties.length > 0) {
            try {
                console.log(`📋 Mapping ${properties.length} properties to asset type ${asset_type_id}`);
                await model.mapAssetTypeToProperties(asset_type_id, properties, org_id, created_by);
                console.log(`✅ Successfully mapped ${properties.length} properties to asset type ${asset_type_id}`);
            } catch (propErr) {
                console.error('❌ Error mapping properties:', propErr);
                // Don't fail the entire operation, just log the error
            }
        } else {
            console.log('⚠️ No properties provided or properties array is empty');
        }

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

// GET /api/asset-types/parents - Get all parent asset types
const getParentAssetTypes = async (req, res) => {
    try {
        const result = await model.getParentAssetTypes();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching parent asset types:", err);
        res.status(500).json({ error: "Failed to fetch parent asset types" });
    }
};

// GET /api/asset-types/assignment-type/:assignment_type - Get asset types by assignment type
const getAssetTypesByAssignmentType = async (req, res) => {
    try {
        const { assignment_type } = req.params;
        
        if (!assignment_type) {
            return res.status(400).json({ error: "Assignment type parameter is required" });
        }
        
        const result = await model.getAssetTypesByAssignmentType(assignment_type);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset types by assignment type:", err);
        res.status(500).json({ error: "Failed to fetch asset types by assignment type" });
    }
};

// GET /api/asset-types/group-required - Get asset types where group_required is true
const getAssetTypesByGroupRequired = async (req, res) => {
    try {
        const result = await model.getAssetTypesByGroupRequired();
        res.status(200).json({
            success: true,
            message: "Asset types retrieved successfully",
            data: result.rows,
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error fetching asset types by group required:", err);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch asset types by group required",
            error: err.message 
        });
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
            org_id,
            int_status,
            maint_required,
            assignment_type,
            inspection_required,
            group_required,
            text,
            is_child,
            parent_asset_type_id,
            maint_type_id,
            maint_lead_type
        } = req.body;

        const changed_by = req.user.user_id;

        // Check if asset type exists
        const existingAsset = await model.getAssetTypeById(id);
        if (existingAsset.rows.length === 0) {
            return res.status(404).json({ error: "Asset type not found" });
        }

        // Validate parent_asset_type_id if is_child is true
        if (is_child && !parent_asset_type_id) {
            return res.status(400).json({
                error: "Parent asset type ID is required when setting as child asset type"
            });
        }

        // Verify parent_asset_type_id exists and is not a child itself
        if (parent_asset_type_id) {
            const parentAssetType = await model.getAssetTypeById(parent_asset_type_id);
            if (parentAssetType.rows.length === 0) {
                return res.status(400).json({
                    error: "Parent asset type not found"
                });
            }
            if (parentAssetType.rows[0].is_child) {
                return res.status(400).json({
                    error: "Cannot set a child asset type as parent"
                });
            }
            // Prevent circular reference
            if (parent_asset_type_id === id) {
                return res.status(400).json({
                    error: "Asset type cannot be its own parent"
                });
            }
        }

        const updateData = {
            org_id: org_id || existingAsset.rows[0].org_id,
            int_status: int_status !== undefined ? int_status : existingAsset.rows[0].int_status,
            maint_required: maint_required || existingAsset.rows[0].maint_required,
            assignment_type: assignment_type || existingAsset.rows[0].assignment_type,
            inspection_required: inspection_required !== undefined ? inspection_required : existingAsset.rows[0].inspection_required,
            group_required: group_required !== undefined ? group_required : existingAsset.rows[0].group_required,
            text: text || existingAsset.rows[0].text,
            is_child: is_child !== undefined ? is_child : existingAsset.rows[0].is_child,
            parent_asset_type_id: parent_asset_type_id !== undefined ? parent_asset_type_id : existingAsset.rows[0].parent_asset_type_id,
            maint_type_id: maint_type_id !== undefined ? maint_type_id : existingAsset.rows[0].maint_type_id,
            maint_lead_type: maint_lead_type !== undefined ? maint_lead_type : existingAsset.rows[0].maint_lead_type
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

        // Check if asset type has child asset types
        const childAssetTypes = await model.getAllAssetTypes();
        const hasChildren = childAssetTypes.rows.some(asset => asset.parent_asset_type_id === id);
        if (hasChildren) {
            return res.status(400).json({
                error: "Cannot delete asset type that has child asset types",
                details: "Please delete or reassign all child asset types first"
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

// GET /api/asset-types/properties - Get all properties
const getAllProperties = async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const properties = await model.getAllProperties(org_id);
        
        res.status(200).json({
            success: true,
            data: properties,
            count: properties.length
        });
    } catch (err) {
        console.error("Error fetching properties:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch properties",
            details: err.message 
        });
    }
};

// GET /api/asset-types/:id/properties - Get properties for a specific asset type
const getAssetTypeProperties = async (req, res) => {
    try {
        const { id } = req.params;
        const org_id = req.user.org_id;
        
        console.log('🔍 Controller: Fetching properties for asset type:', id, 'org:', org_id);
        
        const properties = await model.getAssetTypeProperties(id, org_id);
        
        console.log('✅ Controller: Found properties:', properties.length);
        
        res.status(200).json({
            success: true,
            data: properties,
            count: properties.length
        });
    } catch (err) {
        console.error("❌ Controller: Error fetching asset type properties:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch asset type properties",
            details: err.message 
        });
    }
};

// POST /api/asset-types/:id/properties - Add individual property to asset type
const mapAssetTypeProperties = async (req, res) => {
    try {
        const { id } = req.params;
        const { properties } = req.body;
        const org_id = req.user.org_id;
        const created_by = req.user.user_id;
        
        if (!properties || !Array.isArray(properties) || properties.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Properties array is required"
            });
        }
        
        // If only one property, use the individual add function
        if (properties.length === 1) {
            const result = await model.addAssetTypeProperty(id, properties[0], org_id, created_by);
            
            if (!result.success) {
                return res.status(400).json({
                    success: false,
                    error: result.message
                });
            }
            
            return res.status(200).json({
                success: true,
                message: "Property added successfully",
                asset_type_prop_id: result.asset_type_prop_id
            });
        }
        
        // For multiple properties, use the replace function
        await model.mapAssetTypeToProperties(id, properties, org_id, created_by);
        
        res.status(200).json({
            success: true,
            message: "Properties mapped successfully",
            mapped_count: properties.length
        });
    } catch (err) {
        console.error("Error mapping asset type properties:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to map properties",
            details: err.message 
        });
    }
};

// DELETE /api/asset-types/properties/:assetTypePropId - Delete individual property mapping
const deleteAssetTypeProperty = async (req, res) => {
    try {
        const { assetTypePropId } = req.params;
        
        if (!assetTypePropId) {
            return res.status(400).json({
                success: false,
                error: "Asset type property ID is required"
            });
        }
        
        const result = await model.deleteAssetTypeProperty(assetTypePropId);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Property mapping not found"
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Property mapping deleted successfully"
        });
    } catch (err) {
        console.error("Error deleting asset type property:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to delete property mapping",
            details: err.message 
        });
    }
};

module.exports = {
    addAssetType,
    getAllAssetTypes,
    getAssetTypeById,
    updateAssetType,
    deleteAssetType,
    getParentAssetTypes,
    getAssetTypesByAssignmentType,
    getAssetTypesByGroupRequired,
    getAllProperties,
    getAssetTypeProperties,
    mapAssetTypeProperties,
    deleteAssetTypeProperty
};
