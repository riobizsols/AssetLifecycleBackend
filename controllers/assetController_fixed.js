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
                return res.status(400).json({ error: `Service vendor with ID '${service_vendor_id}' does not exist` });
            }
        }

        if (prod_serv_id) {
            const prodServExists = await model.checkProdServExists(prod_serv_id);
            if (prodServExists.rows.length === 0) {
                console.warn("Invalid prod_serv_id:", prod_serv_id);
                return res.status(400).json({ error: `Product/Service with ID '${prod_serv_id}' does not exist` });
            }
        }

        if (asset_type_id) {
            const assetTypeExists = await model.checkAssetTypeExists(asset_type_id);
            if (assetTypeExists.rows.length === 0) {
                console.warn("Invalid asset_type_id:", asset_type_id);
                return res.status(400).json({ error: `Asset type with ID '${asset_type_id}' does not exist` });
            }
        }

        if (branch_id) {
            const branchExists = await model.checkBranchExists(branch_id);
            if (branchExists.rows.length === 0) {
                console.warn("Invalid branch_id:", branch_id);
                return res.status(400).json({ error: `Branch with ID '${branch_id}' does not exist` });
            }
        }

        if (org_id) {
            const orgExists = await model.checkOrgExists(org_id);
            if (orgExists.rows.length === 0) {
                console.warn("Invalid org_id:", org_id);
                return res.status(400).json({ error: `Organization with ID '${org_id}' does not exist` });
            }
        }

        // Generate asset_id if not provided
        let finalAssetId = asset_id;
        if (!finalAssetId) {
            finalAssetId = await model.generateAssetId();
        }

        // Check if asset_id already exists
        const existingAsset = await model.getAssetById(finalAssetId);
        if (existingAsset.rows.length > 0) {
            return res.status(400).json({ error: `Asset with ID '${finalAssetId}' already exists` });
        }

        // Insert the asset
        const result = await model.insertAsset(
            finalAssetId,
            asset_type_id,
            text,
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
            created_by
        );

        res.status(201).json({
            success: true,
            message: "Asset created successfully",
            asset: result.rows[0]
        });

    } catch (error) {
        console.error("Error creating asset:", error);
        res.status(500).json({ error: "Failed to create asset" });
    }
};

// ... (keeping all other existing functions but removing the bulk upload exports)

module.exports = {
    addAsset,
    getAssets,
    getAssetById,
    updateAsset,
    deleteAsset,
    getPrinterAssets,
    deleteMultipleAssets,
    getAssetsCount
};
