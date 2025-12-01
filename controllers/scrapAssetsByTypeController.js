const model = require("../models/scrapAssetsByTypeModel");
const scrapAssetsLogger = require("../eventLoggers/scrapAssetsEventLogger");

// GET /api/scrap-assets-by-type/:asset_type_id - Get scrap assets by asset type
const getScrapAssetsByAssetType = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const { asset_type_id } = req.params;

    try {
        scrapAssetsLogger.logGetCategoryAssetsApiCalled({
            category: asset_type_id,
            requestData: { operation: 'get_scrap_assets_by_asset_type' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        // Validate asset_type_id parameter
        if (!asset_type_id) {
            return res.status(400).json({
                success: false,
                error: "asset_type_id parameter is required"
            });
        }

        scrapAssetsLogger.logQueryingCategoryAssets({
            category: asset_type_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Check if asset type exists
        const dbPool = req.db || require("../config/db");

        const assetTypeCheck = await dbPool.query(
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
        
        scrapAssetsLogger.logCategoryAssetsRetrieved({
            category: asset_type_id,
            count: result.rows.length,
            userId
        }).catch(err => console.error('Logging error:', err));
        
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
        scrapAssetsLogger.logDataRetrievalError({
            operation: 'get_scrap_assets_by_asset_type',
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap assets by asset type",
            message: err.message 
        });
    }
};

// GET /api/scrap-assets-by-type/asset-types/list - Get all asset types with scrap assets
const getAssetTypesWithScrapAssets = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;

    try {
        scrapAssetsLogger.logGetAllScrapAssetsApiCalled({
            requestData: { operation: 'get_asset_types_with_scrap_assets' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        scrapAssetsLogger.logQueryingScrapAssets({ userId }).catch(err => console.error('Logging error:', err));

        const result = await model.getAssetTypesWithScrapAssets();
        
        scrapAssetsLogger.logScrapAssetsRetrieved({
            count: result.rows.length,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        res.status(200).json({
            success: true,
            message: `Found ${result.rows.length} asset types with scrap assets`,
            count: result.rows.length,
            asset_types: result.rows
        });
    } catch (err) {
        console.error("Error fetching asset types with scrap assets:", err);
        scrapAssetsLogger.logDataRetrievalError({
            operation: 'get_asset_types_with_scrap_assets',
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
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
