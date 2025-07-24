const model = require("../models/assetModel");
const db = require("../config/db");

const getAllAssets = async (req, res) => {
  try {
    const assets = await model.getAllAssets();
    res.json(assets);
  } catch (err) {
    console.error("Error fetching assets:", err);
    res.status(500).json({ error: "Failed to fetch assets" });
  }
};

const addAsset = async (req, res) => {
  try {
    // Get the user's branch_code through their department
    const getUserBranchQuery = `
      SELECT d.branch_code 
      FROM "tblDepartments" d
      JOIN "tblUsers" u ON u.dept_id = d.dept_id
      WHERE u.user_id = $1
    `;
    const branchResult = await db.query(getUserBranchQuery, [req.user.user_id]);
    const branch_id = branchResult.rows[0]?.branch_code;

    if (!branch_id) {
      return res.status(400).json({ error: "User's branch not found" });
    }

    // Add branch_id and created_by to the asset data
    const assetData = {
      ...req.body,
      branch_id,
      ext_id: crypto.randomUUID(),
      created_by: req.user.user_id,
      changed_by: req.user.user_id
    };

    const asset = await model.insertAsset(assetData);
    res.status(201).json(asset);
  } catch (err) {
    console.error("Error adding asset:", err);
    res.status(500).json({ error: "Failed to add asset" });
  }
};

const updateAsset = async (req, res) => {
  const { asset_id } = req.params;
  const {
    asset_type_id,
    serial_number,
    description,
    vendor_id,
    prod_serve_id,
    maintsch_id,
    purchased_cost,
    purchased_on,
    purchased_by,
    expiry_date,
    current_status,
    warranty_period,
    properties
  } = req.body;

  try {
    const updatedAsset = await model.updateAsset(asset_id, {
      asset_type_id,
      serial_number,
      description,
      vendor_id,
      prod_serve_id,
      maintsch_id,
      purchased_cost,
      purchased_on,
      purchased_by,
      expiry_date,
      current_status,
      warranty_period,
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
  updateAsset,
  deleteAsset,
  deleteMultipleAssets,
  getPotentialParentAssets
};
