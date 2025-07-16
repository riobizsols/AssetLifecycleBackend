const model = require("../models/assetModel");

// POST /api/assets - Add new asset
const addAsset = async (req, res) => {
    try {
        const {
            asset_type_id,
            ext_id,
            asset_id, // Optional - auto-generated if not provided
            text,
            serial_number,
            description,
            branch_id,
            vendor_id,
            prod_serve_id,
            maintsch_id,
            purchased_cost,
            purchased_on,
            purchased_by,
            expiry_date,
            current_status = "Active",
            warranty_period,
            parent_id,
            group_id,
            org_id
        } = req.body;

        const created_by = req.user.user_id;

        // Validate required fields
        if (!ext_id || !text || !org_id || !asset_id) {
            return res.status(400).json({ 
                error: "ext_id, text, org_id, and asset_id are required fields" 
            });
        }

        // Validate ext_id is a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(ext_id)) {
            return res.status(400).json({ 
                error: "ext_id must be a valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)" 
            });
        }

        // Check if asset already exists
        const existingAsset = await model.checkAssetExists(ext_id, org_id);
        if (existingAsset.rows.length > 0) {
            return res.status(409).json({ 
                error: "Asset with this ext_id and org_id already exists" 
            });
        }

        // Check if the provided asset_id already exists
        const existingAssetId = await model.checkAssetIdExists(asset_id);
        if (existingAssetId.rows.length > 0) {
            return res.status(409).json({ 
                error: "Asset with this asset_id already exists" 
            });
        }

        // Prepare asset data
        const assetData = {
            asset_type_id,
            ext_id,
            asset_id,
            text,
            serial_number,
            description,
            branch_id,
            vendor_id,
            prod_serve_id,
            maintsch_id,
            purchased_cost,
            purchased_on,
            purchased_by,
            expiry_date,
            current_status,
            warranty_period,
            parent_id,
            group_id,
            org_id,
            created_by
        };

        // Insert new asset
        const result = await model.insertAsset(assetData);

        res.status(201).json({
            message: "Asset added successfully",
            asset: result.rows[0]
        });

    } catch (err) {
        console.error("Error adding asset:", err);
        res.status(500).json({ error: "Internal server error", err });
    }
};

// GET /api/assets - Get all assets
const getAllAssets = async (req, res) => {
    try {
        const result = await model.getAllAssets();
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching assets:", err);
        res.status(500).json({ error: "Failed to fetch assets" });
    }
};

// GET /api/assets/:id - Get asset by ID
const getAssetById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getAssetById(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching asset:", err);
        res.status(500).json({ error: "Failed to fetch asset" });
    }
};

// GET /api/assets/details/:id - Get asset with detailed information
const getAssetWithDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getAssetWithDetails(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Asset not found" });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching asset details:", err);
        res.status(500).json({ error: "Failed to fetch asset details", err });
    }
};

// GET /api/assets/type/:asset_type_id - Get assets by asset type
const getAssetsByAssetType = async (req, res) => {
    try {
        const { asset_type_id } = req.params;
        const result = await model.getAssetsByAssetType(asset_type_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching assets by type:", err);
        res.status(500).json({ error: "Failed to fetch assets by type" });
    }
};

// GET /api/assets/branch/:branch_id - Get assets by branch
const getAssetsByBranch = async (req, res) => {
    try {
        const { branch_id } = req.params;
        const result = await model.getAssetsByBranch(branch_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching assets by branch:", err);
        res.status(500).json({ error: "Failed to fetch assets by branch" });
    }
};

// GET /api/assets/vendor/:vendor_id - Get assets by vendor
const getAssetsByVendor = async (req, res) => {
    try {
        const { vendor_id } = req.params;
        const result = await model.getAssetsByVendor(vendor_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching assets by vendor:", err);
        res.status(500).json({ error: "Failed to fetch assets by vendor" });
    }
};

// GET /api/assets/status/:status - Get assets by status
const getAssetsByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const result = await model.getAssetsByStatus(status);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching assets by status:", err);
        res.status(500).json({ error: "Failed to fetch assets by status" });
    }
};

// GET /api/assets/org/:org_id - Get assets by organization
const getAssetsByOrg = async (req, res) => {
    try {
        const { org_id } = req.params;
        const result = await model.getAssetsByOrg(org_id);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching assets by organization:", err);
        res.status(500).json({ error: "Failed to fetch assets by organization" });
    }
};

// GET /api/assets/search?q=searchTerm - Search assets
const searchAssets = async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: "Search query parameter 'q' is required" });
        }
        
        const result = await model.searchAssets(q);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error searching assets:", err);
        res.status(500).json({ error: "Failed to search assets" });
    }
};

// GET /api/assets - Get assets with query parameters for filtering
const getAssetsWithFilters = async (req, res) => {
    try {
        const { 
            asset_type_id, 
            branch_id, 
            vendor_id, 
            status, 
            org_id,
            search 
        } = req.query;

        let result;

        // Apply filters based on query parameters
        if (asset_type_id) {
            result = await model.getAssetsByAssetType(asset_type_id);
        } else if (branch_id) {
            result = await model.getAssetsByBranch(branch_id);
        } else if (vendor_id) {
            result = await model.getAssetsByVendor(vendor_id);
        } else if (status) {
            result = await model.getAssetsByStatus(status);
        } else if (org_id) {
            result = await model.getAssetsByOrg(org_id);
        } else if (search) {
            result = await model.searchAssets(search);
        } else {
            // No filters, get all assets
            result = await model.getAllAssets();
        }

        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching assets with filters:", err);
        res.status(500).json({ error: "Failed to fetch assets" });
    }
};

module.exports = {
    addAsset,
    getAllAssets,
    getAssetById,
    getAssetWithDetails,
    getAssetsByAssetType,
    getAssetsByBranch,
    getAssetsByVendor,
    getAssetsByStatus,
    getAssetsByOrg,
    searchAssets,
    getAssetsWithFilters
};
