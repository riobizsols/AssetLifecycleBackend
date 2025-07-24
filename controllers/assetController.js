const model = require("../models/assetModel");

// POST /api/assets - Add new asset
const addAsset = async (req, res) => {
    try {
        console.log("Received asset data:", req.body);
        console.log("User info:", req.user);
        
        const {
            asset_type_id,
            ext_id, // Accept ext_id from frontend
            asset_id,
            text,
            serial_number,
            description,
            branch_id,
            vendor_id,
            prod_serve_id, // Accept prod_serve_id from frontend
            maintsch_id,
            purchased_cost,
            purchased_on,
            purchased_by,
            expiry_date,
            current_status = "Active",
            warranty_period,
            parent_asset_id,
            group_id,
            org_id
        } = req.body;

        if (!req.user || !req.user.user_id) {
            return res.status(401).json({ error: "User not authenticated or user_id missing" });
        }

        const created_by = req.user.user_id;

        if (!text || !org_id) {
            return res.status(400).json({ error: "text, and org_id are required fields" });
        }

        if (vendor_id) {
            const vendorExists = await model.checkVendorExists(vendor_id);
            if (vendorExists.rows.length === 0) {
                console.warn("Invalid vendor_id:", vendor_id);
                return res.status(400).json({ error: `Vendor with ID '${vendor_id}' does not exist` });
            }
        }
        // If you want to re-enable prod_serve_id validation, uncomment and update this block:
        // if (prod_serve_id) {
        //     const prodServExists = await model.checkProdServExists(prod_serve_id);
        //     if (prodServExists.rows.length === 0) {
        //         console.warn("Invalid prod_serve_id:", prod_serve_id);
        //         return res.status(400).json({ error: `Product/Service with ID '${prod_serve_id}' does not exist` });
        //     }
        // }

        // Generate or validate asset_id
        let finalAssetId = asset_id;
        if (!asset_id) {
            finalAssetId = await model.generateAssetId();
        } else {
            const existingAssetId = await model.checkAssetIdExists(asset_id);
            if (existingAssetId.rows.length > 0) {
                return res.status(409).json({ error: "Asset with this asset_id already exists" });
            }
        }

        // Prepare asset data (now includes ext_id and prod_serve_id)
        const assetData = {
            asset_type_id,
            ext_id, // Pass ext_id to model/DB
            asset_id: finalAssetId,
            text,
            serial_number,
            description,
            branch_id: branch_id || null,
            vendor_id: vendor_id || null,
            prod_serve_id: prod_serve_id || null, // Use value from frontend
            maintsch_id: maintsch_id || null,
            purchased_cost,
            purchased_on,
            purchased_by: purchased_by || null,
            expiry_date: expiry_date || null,
            current_status,
            warranty_period,
            parent_asset_id,
            group_id,
            // warranty_period: warranty_period || null,
            // parent_id: parent_id || null,
            // group_id: group_id || null,
            org_id,
            created_by
        };

        // Insert asset
        const result = await model.insertAsset(assetData);
        const { asset_id: insertedAssetId, ext_id: insertedExtId } = result.rows[0];

        // Insert properties if any
        if (req.body.properties && Object.keys(req.body.properties).length > 0) {
            console.log('Saving property values:', req.body.properties);
            for (const [propId, value] of Object.entries(req.body.properties)) {
                if (value) {
                    await model.insertAssetPropValue({
                        asset_id: insertedAssetId,
                        ext_id: insertedExtId,
                        org_id,
                        asset_type_prop_id: propId,
                        value
                    });
                }
            }
        }

        res.status(201).json({
            message: "Asset added successfully",
            asset: result.rows[0]
        });

    } catch (err) {
        console.error("Error adding asset:", err);
        res.status(500).json({
            error: "Internal server error",
            message: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};


// GET /api/assets - Get all assets
const getAllAssets = async (req, res) => {
    try {
        const result = await model.getAllAssets();
        if (!result || !result.rows || result.rows.length === 0) {
            console.warn("[getAllAssets] No assets found");
        }
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("[getAllAssets] Error fetching assets:", err);
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

// GET /api/assets/serial/:serial_number - Get assets by serial number
const getAssetsBySerialNumber = async (req, res) => {
    try {
        const { serial_number } = req.params;
        const result = await model.getAssetsBySerialNumber(serial_number);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching assets by serial number:", err);
        res.status(500).json({ error: "Failed to fetch assets by serial number" });
    }
};

// GET /api/assets/type/:asset_type_id/inactive - Get inactive assets by asset type
const getInactiveAssetsByAssetType = async (req, res) => {
    try {
        const { asset_type_id } = req.params;
        const result = await model.getInactiveAssetsByAssetType(asset_type_id);
        
        const count = result.rows.length;
        const message = count > 0 ? `Inactive Assets : ${count}` : "No inactive assets found for this asset type";
        
        res.status(200).json({
            message: message,
            count: count,
            asset_type_id: asset_type_id,
            data: result.rows
        });
    } catch (err) {
        console.error("Error fetching inactive assets by asset type:", err);
        res.status(500).json({ error: "Failed to fetch inactive assets by asset type" });
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

// DELETE /api/assets/:id - Delete single asset
const deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if asset exists
        const existingAsset = await model.getAssetById(id);
        if (existingAsset.rows.length === 0) {
            return res.status(404).json({ error: "Asset not found" });
        }

        // Delete the asset
        const result = await model.deleteAsset(id);

        res.status(200).json({
            message: "Asset deleted successfully",
            deletedAsset: result.rows[0]
        });

    } catch (err) {
        console.error("Error deleting asset:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

// DELETE /api/assets - Delete multiple assets
const deleteMultipleAssets = async (req, res) => {
    try {
        const { asset_ids } = req.body;

        if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
            return res.status(400).json({ 
                error: "asset_ids array is required and must not be empty" 
            });
        }

        // Check if all assets exist
        const existingAssets = [];
        for (const asset_id of asset_ids) {
            const asset = await model.getAssetById(asset_id);
            if (asset.rows.length > 0) {
                existingAssets.push(asset_id);
            }
        }

        if (existingAssets.length === 0) {
            return res.status(404).json({ 
                error: "None of the specified assets were found" 
            });
        }

        // Delete the assets
        const result = await model.deleteMultipleAssets(existingAssets);

        res.status(200).json({
            message: `${result.rows.length} asset(s) deleted successfully`,
            deletedAssets: result.rows,
            requestedCount: asset_ids.length,
            deletedCount: result.rows.length
        });

    } catch (err) {
        console.error("Error deleting multiple assets:", err);
        res.status(500).json({ error: "Internal server error" });
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
    getAssetsBySerialNumber,
    getInactiveAssetsByAssetType,
    getAssetsByOrg,
    searchAssets,
    getAssetsWithFilters,
    deleteAsset,
    deleteMultipleAssets
};
