const model = require("../models/assetModel");
const db = require("../config/db");

// POST /api/assets - Add new asset
const addAsset = async (req, res) => {
    try {
        console.log("Received asset data:", req.body);
        console.log("User info:", req.user);
        
        const {
            asset_type_id,
            asset_id,
            text,
            serial_number,
            description,
            branch_id,
            purchase_vendor_id,
            service_vendor_id,
            prod_serv_id, // Accept prod_serv_id from frontend
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

        if (purchase_vendor_id) {
            const vendorExists = await model.checkVendorExists(purchase_vendor_id);
            if (vendorExists.rows.length === 0) {
                console.warn("Invalid purchase_vendor_id:", purchase_vendor_id);
                return res.status(400).json({ error: `Vendor with ID '${purchase_vendor_id}' does not exist` });
            }
        }
        
        if (service_vendor_id) {
            const vendorExists = await model.checkVendorExists(service_vendor_id);
            if (vendorExists.rows.length === 0) {
                console.warn("Invalid service_vendor_id:", service_vendor_id);
                return res.status(400).json({ error: `Vendor with ID '${service_vendor_id}' does not exist` });
            }
        }
        // If you want to re-enable prod_serv_id validation, uncomment and update this block:
        // if (prod_serv_id) {
        //     const prodServExists = await model.checkProdServExists(prod_serv_id);
        //     if (prodServExists.rows.length === 0) {
        //         console.warn("Invalid prod_serv_id:", prod_serv_id);
        //         return res.status(400).json({ error: `Product/Service with ID '${prod_serv_id}' does not exist` });
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

        // Prepare asset data (now includes prod_serv_id)
        const assetData = {
            asset_type_id,
            asset_id: finalAssetId,
            text,
            serial_number,
            description,
            branch_id: branch_id || null,
            purchase_vendor_id: purchase_vendor_id || null,
            service_vendor_id: service_vendor_id || null,
            prod_serv_id: prod_serv_id || null, // Use value from frontend
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
        const { asset_id: insertedAssetId } = result.rows[0];

        // Insert properties if any
        if (req.body.properties && Object.keys(req.body.properties).length > 0) {
            console.log('Saving property values:', req.body.properties);
            for (const [propId, value] of Object.entries(req.body.properties)) {
                if (value) {
                    await model.insertAssetPropValue({
                        asset_id: insertedAssetId,
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
    const assets = await model.getAllAssets();
    res.json(assets);
  } catch (err) {
    console.error("Error fetching assets:", err);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
};

// const addAsset = async (req, res) => {
//   try {
//     // Get the user's branch_code through their department
//     const getUserBranchQuery = `
//       SELECT d.branch_code 
//       FROM "tblDepartments" d
//       JOIN "tblUsers" u ON u.dept_id = d.dept_id
//       WHERE u.user_id = $1
//     `;
//     const branchResult = await db.query(getUserBranchQuery, [req.user.user_id]);
//     const branch_id = branchResult.rows[0]?.branch_code;

//     if (!branch_id) {
//       return res.status(400).json({ error: "User's branch not found" });
//     }

//     // Add branch_id and created_by to the asset data
//     const assetData = {
//       ...req.body,
//       branch_id,
//       ext_id: crypto.randomUUID(),
//       created_by: req.user.user_id,
//       changed_by: req.user.user_id
//     };

//     const asset = await model.insertAsset(assetData);
//     res.status(201).json(asset);
//   } catch (err) {
//     console.error("Error adding asset:", err);
//     res.status(500).json({ error: "Failed to add asset" });
//   }
// };

const updateAsset = async (req, res) => {
  const { asset_id } = req.params;
  const {
    asset_type_id,
    serial_number,
    description,
    branch_id,
    purchase_vendor_id,
    service_vendor_id,
    prod_serv_id,
    maintsch_id,
    purchased_cost,
    purchased_on,
    purchased_by,
    expiry_date,
    current_status,
    warranty_period,
    parent_asset_id,
    group_id,
    org_id,
    properties
  } = req.body;

  try {
    const updatedAsset = await model.updateAsset(asset_id, {
      asset_type_id,
      serial_number,
      description,
      branch_id,
      purchase_vendor_id,
      service_vendor_id,
      prod_serv_id,
      maintsch_id,
      purchased_cost,
      purchased_on,
      purchased_by,
      expiry_date,
      current_status,
      warranty_period,
      parent_asset_id,
      group_id,
      org_id,
      properties
    });

    if (!updatedAsset) {
      return res.status(404).json({ error: "Asset not found" });
    }

    res.json(updatedAsset);
  } catch (err) {
    console.error("Error updating asset:", err);
    res.status(500).json({ error: "Failed to update asset" });
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
    const { asset_id } = req.params;

    // Check if asset exists
    const existingAsset = await model.getAssetById(asset_id);
    if (existingAsset.rows.length === 0) {
      return res.status(404).json({ error: "Asset not found" });
    }

    // Delete the asset
    const result = await model.deleteAsset(asset_id);
    res.json({
      message: "Asset deleted successfully",
      deletedAsset: result.rows[0]
    });
  } catch (err) {
    console.error("Error deleting asset:", err);

    // Handle foreign key constraint violation
    if (err.code === '23503' && err.table === 'tblAssetAssignments') {
      return res.status(409).json({
        error: "Cannot delete assigned asset",
        message: `Asset ${req.params.asset_id} is currently assigned. Please unassign it first.`,
        code: err.code,
        assetId: req.params.asset_id
      });
    }

    res.status(500).json({ error: "Failed to delete asset" });
  }
};

const deleteMultipleAssets = async (req, res) => {
  try {
    const { asset_ids } = req.body;

    if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
      return res.status(400).json({ error: "asset_ids must be a non-empty array" });
    }

    // Delete the assets
    const result = await model.deleteMultipleAssets(asset_ids);
    res.json({
      message: `${result.rows.length} asset(s) deleted successfully`,
      deletedAssets: result.rows
    });
  } catch (err) {
    console.error("Error deleting assets:", err);
    
    // Handle foreign key constraint violation
    if (err.code === '23503' && err.table === 'tblAssetAssignments') {
      // Extract the asset ID from the error detail
      const assetIdMatch = err.detail.match(/\((.*?)\)/);
      const assetId = assetIdMatch ? assetIdMatch[1] : 'unknown';
      
      return res.status(409).json({
        error: "Cannot delete assigned asset",
        message: `Asset ${assetId} is currently assigned. Please unassign it first.`,
        code: err.code,
        assetId: assetId
      });
    }

    res.status(500).json({ error: "Failed to delete assets" });
  }
};



// GET /api/assets/:id - Get asset by ID
const getAssetById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await model.getAssetById(id);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching asset by ID:', err);
    res.status(500).json({ error: 'Failed to fetch asset by ID' });
  }
};

// POST /api/assets/add   (WEB CONTROLLER) - Create new asset (new function)
const createAsset = async (req, res) => {
    try {
        console.log("Received asset data:", req.body);
        console.log("User info:", req.user);
        
        const {
            asset_type_id,
            asset_id,
            text,
            serial_number,
            description,
            branch_id,
            purchase_vendor_id,
            service_vendor_id,
            prod_serv_id, // Accept prod_serv_id from frontend
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

        if (purchase_vendor_id) {
            const vendorExists = await model.checkVendorExists(purchase_vendor_id);
            if (vendorExists.rows.length === 0) {
                console.warn("Invalid purchase_vendor_id:", purchase_vendor_id);
                return res.status(400).json({ error: `Vendor with ID '${purchase_vendor_id}' does not exist` });
            }
        }
        
        if (service_vendor_id) {
            const vendorExists = await model.checkVendorExists(service_vendor_id);
            if (vendorExists.rows.length === 0) {
                console.warn("Invalid service_vendor_id:", service_vendor_id);
                return res.status(400).json({ error: `Vendor with ID '${service_vendor_id}' does not exist` });
            }
        }

        // Generate or validate asset_id
        let finalAssetId = asset_id;
        if (!asset_id) {
            // Asset ID will be generated inside the transaction in the model
            finalAssetId = ''; // Empty string to trigger generation in model
        } else {
            const existingAssetId = await model.checkAssetIdExists(asset_id);
            if (existingAssetId.rows.length > 0) {
                return res.status(409).json({ error: "Asset with this asset_id already exists" });
            }
        }

        // Prepare asset data (now includes prod_serv_id)
        const assetData = {
            asset_type_id,
            asset_id: finalAssetId,
            text,
            serial_number,
            description,
            branch_id: branch_id || null,
            purchase_vendor_id: purchase_vendor_id || null,
            service_vendor_id: service_vendor_id || null,
            prod_serv_id: prod_serv_id || null, // Use value from frontend
            maintsch_id: maintsch_id || null,
            purchased_cost,
            purchased_on,
            purchased_by: purchased_by || null,
            expiry_date: expiry_date || null,
            current_status,
            warranty_period,
            parent_asset_id,
            group_id,
            org_id,
            created_by
        };

        // Insert asset using the new createAsset function
        const result = await model.createAsset(assetData);
        const { asset_id: insertedAssetId } = result.rows[0];

        // Insert properties if any
        if (req.body.properties && Object.keys(req.body.properties).length > 0) {
            console.log('Saving property values:', req.body.properties);
            for (const [propId, value] of Object.entries(req.body.properties)) {
                if (value) {
                    await model.insertAssetPropValue({
                        asset_id: insertedAssetId,
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
// WEB CONTROLLER
const getPotentialParentAssets = async (req, res) => {
  const { asset_type_id } = req.params;
  try {
    const assets = await model.getPotentialParentAssets(asset_type_id);
    res.json(assets.rows);
  } catch (err) {
    console.error("Error fetching potential parent assets:", err);
    res.status(500).json({ error: "Failed to fetch potential parent assets" });
  }
};

module.exports = {
  getAllAssets,
  addAsset,
  createAsset,
  updateAsset,
  getPotentialParentAssets,
    getAllAssets,
    getAssetById,
    // getAssetWithDetails,
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
