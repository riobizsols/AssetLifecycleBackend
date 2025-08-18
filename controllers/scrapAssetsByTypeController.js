const model = require("../models/scrapAssetsByTypeModel");
const db = require("../config/db");

// GET /api/scrap-assets-by-type/:asset_type_id - Get scrap assets by asset type
const getScrapAssetsByAssetType = async (req, res) => {
    try {
        const { asset_type_id } = req.params;

        // Validate asset_type_id parameter
        if (!asset_type_id) {
            return res.status(400).json({
                success: false,
                error: "asset_type_id parameter is required"
            });
        }

        // Check if asset type exists
        const assetTypeCheck = await db.query(
            'SELECT asset_type_id, text FROM "tblAssetTypes" WHERE asset_type_id = $1',
            [asset_type_id]
        );

        if (assetTypeCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Asset type not found",
                message: `Asset type with ID ${asset_type_id} does not exist`
            });
        }

        const result = await model.getScrapAssetsByAssetType(asset_type_id);
        
        res.status(200).json({
            success: true,
            message: `Found ${result.rows.length} scrap assets for asset type: ${assetTypeCheck.rows[0].text}`,
            asset_type: {
                asset_type_id: assetTypeCheck.rows[0].asset_type_id,
                asset_type_name: assetTypeCheck.rows[0].text
            },
            count: result.rows.length,
            scrap_assets: result.rows
        });
    } catch (err) {
        console.error("Error fetching scrap assets by asset type:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap assets by asset type",
            message: err.message 
        });
    }
};

// GET /api/scrap-assets-by-type/asset-types/list - Get all asset types with scrap assets
const getAssetTypesWithScrapAssets = async (req, res) => {
    try {
        const result = await model.getAssetTypesWithScrapAssets();
        
        res.status(200).json({
            success: true,
            message: `Found ${result.rows.length} asset types with scrap assets`,
            count: result.rows.length,
            asset_types: result.rows
        });
    } catch (err) {
        console.error("Error fetching asset types with scrap assets:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch asset types with scrap assets",
            message: err.message 
        });
    }
};

module.exports = {
    getScrapAssetsByAssetType,
    getAssetTypesWithScrapAssets
};
