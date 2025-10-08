const model = require("../models/assetModel");
const db = require("../config/db");

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


const updateAsset = async (req, res) => {
  const { asset_id } = req.params;
  
  // Get user's branch information
  const userModel = require("../models/userModel");
  const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
  const userBranchId = userWithBranch?.branch_id;
  
  console.log("User branch ID for update:", userBranchId);
  
  const {
    asset_type_id,
    serial_number,
    description,
    branch_id = userBranchId, // Use user's branch if not provided
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
    // Get existing asset to retrieve org_id if not provided
    let finalOrgId = org_id || req.user?.org_id;
    if (!finalOrgId) {
      const existingAsset = await model.getAssetById(asset_id);
      if (existingAsset.rows.length > 0) {
        finalOrgId = existingAsset.rows[0].org_id;
      }
    }
    
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
      org_id: finalOrgId,
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
        res.status(200).json({
            success: true,
            message: "Assets retrieved successfully",
            data: result.rows,
            count: result.rows.length,
            asset_type_id: asset_type_id,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error fetching assets by type:", err);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch assets by type",
            error: err.message 
        });
    }
};

// GET /api/assets/printers - Get printer assets using organization settings
const getPrinterAssets = async (req, res) => {
    try {
        const result = await model.getPrinterAssets();
        res.status(200).json({
            success: true,
            message: "Printer assets retrieved successfully",
            data: result.rows,
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error("Error fetching printer assets:", err);
        res.status(500).json({ 
            success: false,
            message: "Failed to fetch printer assets",
            error: err.message 
        });
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
        
        if (!serial_number) {
            return res.status(400).json({ error: "Serial number parameter is required" });
        }
        
        const result = await model.getAssetsBySerialNumber(serial_number);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching assets by serial number:", err);
        res.status(500).json({ error: "Failed to fetch assets by serial number" });
    }
};

// GET /api/assets/expiring-within-30-days - Get assets expiring within 30 days
const getAssetsExpiringWithin30Days = async (req, res) => {
    try {
        const result = await model.getAssetsExpiringWithin30Days();
        
        res.status(200).json({
            message: `Found ${result.rows.length} assets expiring within 30 days`,
            days: 30,
            count: result.rows.length,
            assets: result.rows
        });
    } catch (err) {
        console.error("Error fetching assets expiring within 30 days:", err);
        res.status(500).json({ error: "Failed to fetch assets expiring within 30 days" });
    }
};

// GET /api/assets/expiry/:filterType - Get assets by expiry date
const getAssetsByExpiryDate = async (req, res) => {
    try {
        const { filterType } = req.params;
        const { value, days } = req.query;
        
        let filterValue = value;
        
        // Handle different filter types
        switch (filterType) {
            case 'expired':
                // Get expired assets
                const expiredResult = await model.getAssetsByExpiryDate('expired');
                res.status(200).json({
                    message: `Found ${expiredResult.rows.length} expired assets`,
                    filter_type: 'expired',
                    count: expiredResult.rows.length,
                    assets: expiredResult.rows
                });
                break;

            case 'expiring_soon':
                // Get assets expiring soon (default 30 days)
                const daysNumber = parseInt(days) || 30;
                if (isNaN(daysNumber) || daysNumber < 1) {
                    return res.status(400).json({ 
                        error: "Days parameter must be a positive number" 
                    });
                }
                const expiringSoonResult = await model.getAssetsByExpiryDate('expiring_soon', daysNumber);
                res.status(200).json({
                    message: `Found ${expiringSoonResult.rows.length} assets expiring within ${daysNumber} days`,
                    filter_type: 'expiring_soon',
                    days: daysNumber,
                    count: expiringSoonResult.rows.length,
                    assets: expiringSoonResult.rows
                });
                break;

            case 'expiring_on':
                // Get assets expiring on a specific date
                if (!value) {
                    return res.status(400).json({ 
                        error: "Date parameter is required for 'expiring_on' filter" 
                    });
                }
                const expiringOnResult = await model.getAssetsByExpiryDate('expiring_on', value);
                res.status(200).json({
                    message: `Found ${expiringOnResult.rows.length} assets expiring on ${value}`,
                    filter_type: 'expiring_on',
                    date: value,
                    count: expiringOnResult.rows.length,
                    assets: expiringOnResult.rows
                });
                break;

            case 'expiring_between':
                // Get assets expiring between two dates
                if (!value || !value.includes(',')) {
                    return res.status(400).json({ 
                        error: "Date range parameter is required for 'expiring_between' filter (format: startDate,endDate)" 
                    });
                }
                const expiringBetweenResult = await model.getAssetsByExpiryDate('expiring_between', value);
                const [startDate, endDate] = value.split(',');
                res.status(200).json({
                    message: `Found ${expiringBetweenResult.rows.length} assets expiring between ${startDate} and ${endDate}`,
                    filter_type: 'expiring_between',
                    start_date: startDate,
                    end_date: endDate,
                    count: expiringBetweenResult.rows.length,
                    assets: expiringBetweenResult.rows
                });
                break;

            case 'no_expiry':
                // Get assets with no expiry date
                const noExpiryResult = await model.getAssetsByExpiryDate('no_expiry');
                res.status(200).json({
                    message: `Found ${noExpiryResult.rows.length} assets with no expiry date`,
                    filter_type: 'no_expiry',
                    count: noExpiryResult.rows.length,
                    assets: noExpiryResult.rows
                });
                break;

            case 'all':
                // Get all assets with expiry date info
                const allResult = await model.getAssetsByExpiryDate('all');
                res.status(200).json({
                    message: `Found ${allResult.rows.length} assets with expiry date information`,
                    filter_type: 'all',
                    count: allResult.rows.length,
                    assets: allResult.rows
                });
                break;

            default:
                return res.status(400).json({ 
                    error: "Invalid filter type. Valid types: expired, expiring_soon, expiring_on, expiring_between, no_expiry, all" 
                });
        }
    } catch (err) {
        console.error("Error fetching assets by expiry date:", err);
        res.status(500).json({ error: "Failed to fetch assets by expiry date" });
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

    // Handle foreign key constraint violations with specific error messages
    if (err.code === '23503') {
      const constraintName = err.constraint;
      const tableName = err.table;
      
      // Map constraint names to user-friendly messages
      const constraintMessages = {
        'tblAssetAssignments': 'This asset is currently assigned to an employee. Please unassign it first.',
        'tblAssetDocs': 'This asset has attached documents. Please delete all documents first.',
        'tblAssetGroup_D': 'This asset is part of an asset group. Please remove it from the group first.',
        'tblAssetMaintSch': 'This asset has maintenance schedules. Please delete all maintenance schedules first.',
        'tblAssetMaintDocs': 'This asset has maintenance documents. Please delete all maintenance documents first.',
        'tblAssetPropValues': 'This asset has property values. Please delete all property values first.',
        'tblAssetScrapDet': 'This asset is in scrap details. Please remove it from scrap details first.',
        'tblAssetDepHist': 'This asset has depreciation history. Please contact administrator.',
        'tblAssetBRDet': 'This asset has breakdown details. Please contact administrator.',
        'tblWFAssetMaintSch_H': 'This asset has workflow maintenance schedules. Please contact administrator.'
      };

      // Get the specific table name from the constraint or error details
      let specificTable = tableName;
      if (!specificTable && constraintName) {
        // Try to extract table name from constraint name
        for (const table of Object.keys(constraintMessages)) {
          if (constraintName.includes(table)) {
            specificTable = table;
            break;
          }
        }
      }

      const errorMessage = constraintMessages[specificTable] || 
        `This asset is referenced by other records in the system. Please remove all references first.`;

      return res.status(409).json({
        error: "Cannot delete asset",
        message: errorMessage,
        details: {
          assetId: req.params.asset_id,
          constraint: constraintName,
          table: specificTable,
          code: err.code
        },
        suggestion: "Please check the asset's assignments, documents, maintenance schedules, and other related records before attempting to delete."
      });
    }

    // Handle other database errors
    if (err.code === '23502') {
      return res.status(400).json({
        error: "Invalid asset data",
        message: "Required fields are missing for asset deletion.",
        code: err.code
      });
    }

    // Generic error fallback
    res.status(500).json({ 
      error: "Failed to delete asset",
      message: "An unexpected error occurred while deleting the asset. Please try again.",
      code: err.code || 'UNKNOWN_ERROR'
    });
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
    
    // Handle foreign key constraint violations with specific error messages
    if (err.code === '23503') {
      const constraintName = err.constraint;
      const tableName = err.table;
      
      // Map constraint names to user-friendly messages
      const constraintMessages = {
        'tblAssetAssignments': 'One or more assets are currently assigned to employees. Please unassign them first.',
        'tblAssetDocs': 'One or more assets have attached documents. Please delete all documents first.',
        'tblAssetGroup_D': 'One or more assets are part of asset groups. Please remove them from groups first.',
        'tblAssetMaintSch': 'One or more assets have maintenance schedules. Please delete all maintenance schedules first.',
        'tblAssetMaintDocs': 'One or more assets have maintenance documents. Please delete all maintenance documents first.',
        'tblAssetPropValues': 'One or more assets have property values. Please delete all property values first.',
        'tblAssetScrapDet': 'One or more assets are in scrap details. Please remove them from scrap details first.',
        'tblAssetDepHist': 'One or more assets have depreciation history. Please contact administrator.',
        'tblAssetBRDet': 'One or more assets have breakdown details. Please contact administrator.',
        'tblWFAssetMaintSch_H': 'One or more assets have workflow maintenance schedules. Please contact administrator.'
      };

      // Get the specific table name from the constraint or error details
      let specificTable = tableName;
      if (!specificTable && constraintName) {
        // Try to extract table name from constraint name
        for (const table of Object.keys(constraintMessages)) {
          if (constraintName.includes(table)) {
            specificTable = table;
            break;
          }
        }
      }

      const errorMessage = constraintMessages[specificTable] || 
        `One or more assets are referenced by other records in the system. Please remove all references first.`;

      // Try to extract specific asset ID from error detail
      const assetIdMatch = err.detail ? err.detail.match(/\((.*?)\)/) : null;
      const specificAssetId = assetIdMatch ? assetIdMatch[1] : null;

      return res.status(409).json({
        error: "Cannot delete assets",
        message: errorMessage,
        details: {
          constraint: constraintName,
          table: specificTable,
          code: err.code,
          specificAssetId: specificAssetId
        },
        suggestion: "Please check each asset's assignments, documents, maintenance schedules, and other related records before attempting to delete."
      });
    }

    // Handle other database errors
    if (err.code === '23502') {
      return res.status(400).json({
        error: "Invalid asset data",
        message: "Required fields are missing for asset deletion.",
        code: err.code
      });
    }

    // Generic error fallback
    res.status(500).json({ 
      error: "Failed to delete assets",
      message: "An unexpected error occurred while deleting the assets. Please try again.",
      code: err.code || 'UNKNOWN_ERROR'
    });
  }
};



// GET /api/assets/:id - Get asset by ID
const getAssetById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use getAssetWithDetails to get complete asset information
    const result = await model.getAssetWithDetails(id);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    
    // Fetch asset properties
    const propertiesResult = await model.getAssetProperties(id);
    const properties = {};
    propertiesResult.rows.forEach(prop => {
      properties[prop.property] = prop.value;
    });
    
    const asset = result.rows[0];
    asset.properties = properties;
    
    res.status(200).json(asset);
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
        
        // Get user's branch information
        const userModel = require("../models/userModel");
        const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
        const userBranchId = userWithBranch?.branch_id;
        
        console.log("User branch ID:", userBranchId);
        
        const {
            asset_type_id,
            asset_id,
            text,
            serial_number,
            description,
            branch_id = userBranchId, // Use user's branch if not provided
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
            org_id,
            // Depreciation fields
            salvage_value,
            useful_life_years,
            current_book_value,
            accumulated_depreciation,
            last_depreciation_calc_date,
            depreciation_start_date
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

        // Check and create vendor product service record if prod_serv_id exists
        if (prod_serv_id && purchase_vendor_id) {
            console.log('🔍 Checking vendor product service for prod_serv_id:', prod_serv_id, 'vendor_id:', purchase_vendor_id);
            
            // Check if the combination already exists in tblVendorProdService
            const existingVendorProdService = await db.query(
                `SELECT ven_prod_serv_id FROM "tblVendorProdService" 
                 WHERE prod_serv_id = $1 AND vendor_id = $2 AND org_id = $3`,
                [prod_serv_id, purchase_vendor_id, org_id]
            );
            
            if (existingVendorProdService.rows.length === 0) {
                console.log('📝 Creating new vendor product service record...');
                
                // Generate continuous ven_prod_serv_id
                const venProdServResult = await db.query(
                    `SELECT ven_prod_serv_id FROM "tblVendorProdService" 
                     ORDER BY ven_prod_serv_id DESC LIMIT 1`
                );
                
                let newNumber = 1;
                if (venProdServResult.rows.length > 0) {
                    const lastId = venProdServResult.rows[0].ven_prod_serv_id;
                    if (/^VPS\d+$/.test(lastId)) {
                        newNumber = parseInt(lastId.replace('VPS', '')) + 1;
                    }
                }
                
                const ven_prod_serv_id = `VPS${String(newNumber).padStart(3, '0')}`;
                
                // Insert new vendor product service record
                await db.query(
                    `INSERT INTO "tblVendorProdService" (ven_prod_serv_id, prod_serv_id, vendor_id, org_id)
                     VALUES ($1, $2, $3, $4)`,
                    [ven_prod_serv_id, prod_serv_id, purchase_vendor_id, org_id]
                );
                
                console.log('✅ Created vendor product service record:', ven_prod_serv_id);
            } else {
                console.log('✅ Vendor product service record already exists:', existingVendorProdService.rows[0].ven_prod_serv_id);
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
        
        // Check if an asset with the same serial number already exists
        if (serial_number) {
            const existingSerial = await model.getAssetsBySerialNumber(serial_number);
            if (existingSerial.rows.length > 0) {
                return res.status(409).json({ error: "Asset with this serial number already exists" });
            }
        }
        
        // Get asset type's depreciation method to calculate correct rate
        let calculatedDepreciationRate = 0;
        let depreciationType = 'SL'; // Default to Straight Line
        
        if (asset_type_id) {
            try {
                const assetTypeQuery = `
                    SELECT depreciation_type 
                    FROM "tblAssetTypes" 
                    WHERE asset_type_id = $1
                `;
                const assetTypeResult = await db.query(assetTypeQuery, [asset_type_id]);
                
                if (assetTypeResult.rows.length > 0) {
                    depreciationType = assetTypeResult.rows[0].depreciation_type || 'SL';
                }
                
                console.log('🔍 Asset Type Depreciation Method:', depreciationType);
            } catch (error) {
                console.warn('⚠️ Failed to fetch asset type depreciation method, defaulting to SL:', error.message);
                depreciationType = 'SL';
            }
        }
        
        // Calculate depreciation rate based on the asset type's method
       // Calculate depreciation rate based on the asset type's method
if (useful_life_years && useful_life_years > 0) {
    const cost = parseFloat(purchased_cost) || 0;
    const salvage = parseFloat(salvage_value) || 0;

    if (depreciationType === 'SL') {
        // Straight Line: 100% / useful life years
        calculatedDepreciationRate = (1 / useful_life_years) * 100;

    } else if (depreciationType === 'RB') {
        // Reducing Balance: precise formula to hit salvage value exactly
        if (cost > 0 && salvage >= 0 && salvage < cost) {
            const rate = 1 - Math.pow(salvage / cost, 1 / useful_life_years);
            calculatedDepreciationRate = rate * 100;
        } else {
            calculatedDepreciationRate = 0;
        }

    } else if (depreciationType === 'DD') {
        // Double Declining, adjusted to ensure final year ends at salvage value
        if (cost > 0 && salvage >= 0 && salvage < cost) {
            let rate = (2 / useful_life_years);
            // If standard DDB would go below salvage too early, adjust to RB formula
            const rbRate = 1 - Math.pow(salvage / cost, 1 / useful_life_years);
            if (rbRate < rate) {
                rate = rbRate; // ensures salvage value is respected
            }
            calculatedDepreciationRate = rate * 100;
        } else {
            calculatedDepreciationRate = (2 / useful_life_years) * 100;
        }

    } else {
        calculatedDepreciationRate = 0; // No Depreciation (ND)
    }
}

        
        console.log('🔢 Depreciation Calculation:');
        console.log('  Asset Type ID:', asset_type_id);
        console.log('  Depreciation Method:', depreciationType);
        console.log('  Useful Life Years:', useful_life_years);
        console.log('  Calculated Depreciation Rate:', calculatedDepreciationRate);
        
        // Prepare asset data (now includes prod_serv_id and depreciation fields)
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
            created_by,
            // Depreciation fields
            salvage_value: parseFloat(salvage_value) || 0,
            useful_life_years: parseInt(useful_life_years) || 5,
            depreciation_rate: calculatedDepreciationRate,
            current_book_value: parseFloat(current_book_value) || parseFloat(purchased_cost) || 0,
            accumulated_depreciation: parseFloat(accumulated_depreciation) || 0,
            last_depreciation_calc_date: last_depreciation_calc_date || null,
            depreciation_start_date: depreciation_start_date || purchased_on
        };

        // Start a transaction to ensure atomicity
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            
            // Insert asset using the new createAsset function
            const result = await model.createAsset(assetData);
            const { asset_id: insertedAssetId } = result.rows[0];

            // No need to increment sequence since we're now using the actual serial numbers
            console.log(`✅ Asset created successfully with serial number: ${serial_number}`);

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

            await client.query('COMMIT');
            
            res.status(201).json({
                message: "Asset added successfully",
                asset: result.rows[0]
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Error adding asset:", err);
        res.status(500).json({
            error: "Internal server error",
            message: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
};

// GET /api/assets/expiring-30-days-by-type - Get assets expiring within 30 days grouped by asset type
const getAssetsExpiringWithin30DaysByType = async (req, res) => {
    try {
        const result = await model.getAssetsExpiringWithin30DaysByType();
        
        // Calculate total count
        const totalCount = result.rows.reduce((sum, type) => sum + parseInt(type.asset_count), 0);
        
        res.status(200).json({
            message: `Found ${totalCount} assets expiring within 30 days across ${result.rows.length} asset types`,
            days: 30,
            total_count: totalCount,
            asset_types_count: result.rows.length,
            asset_types: result.rows
        });
    } catch (err) {
        console.error("Error fetching assets expiring within 30 days by type:", err);
        res.status(500).json({ error: "Failed to fetch assets expiring within 30 days by type" });
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

// GET /api/assets/count - Get total count of assets
const getAssetsCount = async (req, res) => {
  try {
    const count = await model.getAssetsCount();
    res.json({
      success: true,
      count: count.rows[0].count,
      message: "Total assets count retrieved successfully"
    });
  } catch (err) {
    console.error("Error fetching assets count:", err);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch assets count",
      message: err.message 
    });
  }
};

module.exports = {
  getAllAssets,
  addAsset,
  createAsset,
  updateAsset,
  getPotentialParentAssets,
  getAssetById,
  getAssetsByAssetType,
  getPrinterAssets,
  getAssetsByBranch,
  getAssetsByVendor,
  getAssetsByStatus,
  getAssetsBySerialNumber,
  getAssetsExpiringWithin30Days,
  getAssetsByExpiryDate,
  getAssetsExpiringWithin30DaysByType,
  getInactiveAssetsByAssetType,
  getAssetsByOrg,
  searchAssets,
  getAssetsWithFilters,
  deleteAsset,
  deleteMultipleAssets,
  getAssetsCount
};
