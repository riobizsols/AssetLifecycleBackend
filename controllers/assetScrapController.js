const model = require("../models/assetScrapModel");
const scrapAssetsLogger = require("../eventLoggers/scrapAssetsEventLogger");

// GET /api/scrap-assets - Get all scrap assets
const getAllScrapAssets = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        scrapAssetsLogger.logGetAllScrapAssetsApiCalled({
            requestData: { operation: 'get_all_scrap_assets' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        scrapAssetsLogger.logQueryingScrapAssets({ userId }).catch(err => console.error('Logging error:', err));
        
        const org_id = req.user?.org_id;
        const branch_id = req.user?.branch_id;
        const hasSuperAccess = req.user?.hasSuperAccess || false;
        
        const result = await model.getAllScrapAssets(org_id, branch_id, hasSuperAccess);
        
        if (result.rows.length === 0) {
            scrapAssetsLogger.logNoScrapAssetsFound({ userId }).catch(err => console.error('Logging error:', err));
        } else {
            scrapAssetsLogger.logScrapAssetsRetrieved({
                count: result.rows.length,
                userId
            }).catch(err => console.error('Logging error:', err));
        }
        
        res.status(200).json({
            success: true,
            message: `Found ${result.rows.length} scrap assets`,
            count: result.rows.length,
            scrap_assets: result.rows
        });
    } catch (err) {
        console.error("Error fetching scrap assets:", err);
        scrapAssetsLogger.logScrapAssetsRetrievalError({
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap assets",
            message: err.message 
        });
    }
};

// GET /api/scrap-assets/:id - Get scrap asset by ID
const getScrapAssetById = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const { id } = req.params;
    
    try {
        scrapAssetsLogger.logGetScrapAssetByIdApiCalled({
            scrapAssetId: id,
            requestData: { operation: 'get_scrap_asset_by_id' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        scrapAssetsLogger.logQueryingScrapAssetById({
            scrapAssetId: id,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        const result = await model.getScrapAssetById(id);
        
        if (result.rows.length === 0) {
            scrapAssetsLogger.logScrapAssetNotFound({
                scrapAssetId: id,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(404).json({
                success: false,
                error: "Scrap asset not found"
            });
        }
        
        scrapAssetsLogger.logScrapAssetDetailRetrieved({
            scrapAssetId: id,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        res.status(200).json({
            success: true,
            message: "Scrap asset retrieved successfully",
            scrap_asset: result.rows[0]
        });
    } catch (err) {
        console.error("Error fetching scrap asset:", err);
        scrapAssetsLogger.logScrapAssetDetailRetrievalError({
            scrapAssetId: id,
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap asset",
            message: err.message 
        });
    }
};

// GET /api/scrap-assets/available-by-type/:asset_type_id - Get available assets by asset type
const getAvailableAssetsByAssetType = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const { asset_type_id } = req.params;
    const { org_id } = req.query;

    try {
        scrapAssetsLogger.logGetAvailableAssetsByTypeApiCalled({
            assetTypeId: asset_type_id,
            requestData: { operation: 'get_available_assets_by_type', org_id },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        if (!asset_type_id) {
            return res.status(400).json({
                success: false,
                error: "asset_type_id is required"
            });
        }

        scrapAssetsLogger.logQueryingAvailableAssetsByType({
            assetTypeId: asset_type_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.getAvailableAssetsByAssetType(asset_type_id, org_id || null);

        if (result.rows.length === 0) {
            scrapAssetsLogger.logNoAvailableAssetsFound({
                assetTypeId: asset_type_id,
                userId
            }).catch(err => console.error('Logging error:', err));
        } else {
            scrapAssetsLogger.logAvailableAssetsRetrieved({
                assetTypeId: asset_type_id,
                count: result.rows.length,
                userId
            }).catch(err => console.error('Logging error:', err));
        }

        res.status(200).json({
            success: true,
            message: `Found ${result.rows.length} available assets for asset_type_id ${asset_type_id}`,
            count: result.rows.length,
            asset_type_id,
            org_id: org_id || null,
            assets: result.rows
        });
    } catch (err) {
        console.error("Error fetching available assets by asset type:", err);
        scrapAssetsLogger.logAvailableAssetsRetrievalError({
            assetTypeId: asset_type_id,
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch available assets by asset type",
            message: err.message 
        });
    }
};



// POST /api/scrap-assets - Add new scrap asset
const addScrapAsset = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const requestData = req.body;
    
    try {
        scrapAssetsLogger.logAddScrapAssetApiCalled({
            requestData,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        const {
            asset_id,
            scrapped_date,
            scrapped_by,
            location,
            notes,
            org_id
        } = req.body;

        scrapAssetsLogger.logValidatingScrapAssetData({
            requestData,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Validate required fields
        if (!asset_id || !scrapped_date || !scrapped_by || !org_id) {
            const missingFields = [];
            if (!asset_id) missingFields.push('asset_id');
            if (!scrapped_date) missingFields.push('scrapped_date');
            if (!scrapped_by) missingFields.push('scrapped_by');
            if (!org_id) missingFields.push('org_id');
            
            scrapAssetsLogger.logMissingRequiredFields({
                missingFields,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(400).json({
                success: false,
                error: "asset_id, scrapped_date, scrapped_by, and org_id are required fields"
            });
        }

        scrapAssetsLogger.logValidationSuccess({
            requestData,
            userId
        }).catch(err => console.error('Logging error:', err));

        scrapAssetsLogger.logProcessingScrapAssetCreation({
            requestData,
            userId
        }).catch(err => console.error('Logging error:', err));

        const scrapData = {
            asset_id,
            scrapped_date,
            scrapped_by,
            location: location || null,
            notes: notes || null,
            org_id
        };

        scrapAssetsLogger.logInsertingScrapAssetToDatabase({
            requestData: scrapData,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.addScrapAsset(scrapData);
        
        scrapAssetsLogger.logScrapAssetInsertedToDatabase({
            scrapAssetId: result.rows[0]?.scrap_asset_id,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        scrapAssetsLogger.logScrapAssetCreated({
            scrapAssetId: result.rows[0]?.scrap_asset_id,
            requestData,
            responseData: result.rows[0],
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        res.status(201).json({
            success: true,
            message: "Scrap asset added successfully",
            scrap_asset: result.rows[0]
        });
    } catch (err) {
        console.error("Error adding scrap asset:", err);
        scrapAssetsLogger.logScrapAssetCreationError({
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to add scrap asset",
            message: err.message 
        });
    }
};

// PUT /api/scrap-assets/:id - Update scrap asset
const updateScrapAsset = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const { id } = req.params;
    const requestData = req.body;
    
    try {
        scrapAssetsLogger.logUpdateScrapAssetApiCalled({
            scrapAssetId: id,
            requestData,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        const {
            asset_id,
            scrapped_date,
            scrapped_by,
            location,
            notes,
            org_id
        } = req.body;

        scrapAssetsLogger.logValidatingUpdateData({
            scrapAssetId: id,
            requestData,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Check if scrap asset exists
        const exists = await model.checkScrapAssetExists(id);
        if (exists.rows.length === 0) {
            scrapAssetsLogger.logScrapAssetNotFound({
                scrapAssetId: id,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(404).json({
                success: false,
                error: "Scrap asset not found"
            });
        }

        // Validate required fields
        if (!asset_id || !scrapped_date || !scrapped_by || !org_id) {
            const missingFields = [];
            if (!asset_id) missingFields.push('asset_id');
            if (!scrapped_date) missingFields.push('scrapped_date');
            if (!scrapped_by) missingFields.push('scrapped_by');
            if (!org_id) missingFields.push('org_id');
            
            scrapAssetsLogger.logMissingRequiredFields({
                missingFields,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(400).json({
                success: false,
                error: "asset_id, scrapped_date, scrapped_by, and org_id are required fields"
            });
        }

        scrapAssetsLogger.logProcessingScrapAssetUpdate({
            scrapAssetId: id,
            requestData,
            userId
        }).catch(err => console.error('Logging error:', err));

        const updateData = {
            asset_id,
            scrapped_date,
            scrapped_by,
            location: location || null,
            notes: notes || null,
            org_id
        };

        scrapAssetsLogger.logUpdatingScrapAssetInDatabase({
            scrapAssetId: id,
            requestData: updateData,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.updateScrapAsset(id, updateData);
        
        scrapAssetsLogger.logScrapAssetUpdatedInDatabase({
            scrapAssetId: id,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        scrapAssetsLogger.logScrapAssetUpdated({
            scrapAssetId: id,
            requestData,
            responseData: result.rows[0],
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        res.status(200).json({
            success: true,
            message: "Scrap asset updated successfully",
            scrap_asset: result.rows[0]
        });
    } catch (err) {
        console.error("Error updating scrap asset:", err);
        scrapAssetsLogger.logScrapAssetUpdateError({
            scrapAssetId: id,
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to update scrap asset",
            message: err.message 
        });
    }
};

// DELETE /api/scrap-assets/:id - Delete scrap asset
const deleteScrapAsset = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    const { id } = req.params;
    
    try {
        scrapAssetsLogger.logDeleteScrapAssetApiCalled({
            scrapAssetId: id,
            requestData: { operation: 'delete_scrap_asset' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        scrapAssetsLogger.logValidatingScrapAssetDeletion({
            scrapAssetId: id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Check if scrap asset exists
        const exists = await model.checkScrapAssetExists(id);
        if (exists.rows.length === 0) {
            scrapAssetsLogger.logScrapAssetNotFoundForDeletion({
                scrapAssetId: id,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(404).json({
                success: false,
                error: "Scrap asset not found"
            });
        }

        scrapAssetsLogger.logProcessingScrapAssetDeletion({
            scrapAssetId: id,
            userId
        }).catch(err => console.error('Logging error:', err));

        scrapAssetsLogger.logDeletingScrapAssetFromDatabase({
            scrapAssetId: id,
            userId
        }).catch(err => console.error('Logging error:', err));

        const result = await model.deleteScrapAsset(id);
        
        scrapAssetsLogger.logScrapAssetDeletedFromDatabase({
            scrapAssetId: id,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        scrapAssetsLogger.logScrapAssetDeleted({
            scrapAssetId: id,
            requestData: { operation: 'delete_scrap_asset' },
            responseData: result.rows[0],
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        res.status(200).json({
            success: true,
            message: "Scrap asset deleted successfully",
            deleted_scrap_asset: result.rows[0]
        });
    } catch (err) {
        console.error("Error deleting scrap asset:", err);
        scrapAssetsLogger.logScrapAssetDeletionError({
            scrapAssetId: id,
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ 
            success: false,
            error: "Failed to delete scrap asset",
            message: err.message 
        });
    }
};

module.exports = {
    getAllScrapAssets,
    getScrapAssetById,
    getAvailableAssetsByAssetType,
    addScrapAsset,
    updateScrapAsset,
    deleteScrapAsset
};
