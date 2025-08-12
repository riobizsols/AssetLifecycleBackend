const model = require("../models/assetScrapModel");

// GET /api/scrap-assets - Get all scrap assets
const getAllScrapAssets = async (req, res) => {
    try {
        const result = await model.getAllScrapAssets();
        
        res.status(200).json({
            success: true,
            message: `Found ${result.rows.length} scrap assets`,
            count: result.rows.length,
            scrap_assets: result.rows
        });
    } catch (err) {
        console.error("Error fetching scrap assets:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap assets",
            message: err.message 
        });
    }
};

// GET /api/scrap-assets/:id - Get scrap asset by ID
const getScrapAssetById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await model.getScrapAssetById(id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Scrap asset not found"
            });
        }
        
        res.status(200).json({
            success: true,
            message: "Scrap asset retrieved successfully",
            scrap_asset: result.rows[0]
        });
    } catch (err) {
        console.error("Error fetching scrap asset:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch scrap asset",
            message: err.message 
        });
    }
};



// POST /api/scrap-assets - Add new scrap asset
const addScrapAsset = async (req, res) => {
    try {
        const {
            asset_id,
            scrapped_date,
            scrapped_by,
            location,
            notes,
            org_id
        } = req.body;

        // Validate required fields
        if (!asset_id || !scrapped_date || !scrapped_by || !org_id) {
            return res.status(400).json({
                success: false,
                error: "asset_id, scrapped_date, scrapped_by, and org_id are required fields"
            });
        }

        const scrapData = {
            asset_id,
            scrapped_date,
            scrapped_by,
            location: location || null,
            notes: notes || null,
            org_id
        };

        const result = await model.addScrapAsset(scrapData);
        
        res.status(201).json({
            success: true,
            message: "Scrap asset added successfully",
            scrap_asset: result.rows[0]
        });
    } catch (err) {
        console.error("Error adding scrap asset:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to add scrap asset",
            message: err.message 
        });
    }
};

// PUT /api/scrap-assets/:id - Update scrap asset
const updateScrapAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            asset_id,
            scrapped_date,
            scrapped_by,
            location,
            notes,
            org_id
        } = req.body;

        // Check if scrap asset exists
        const exists = await model.checkScrapAssetExists(id);
        if (exists.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Scrap asset not found"
            });
        }

        // Validate required fields
        if (!asset_id || !scrapped_date || !scrapped_by || !org_id) {
            return res.status(400).json({
                success: false,
                error: "asset_id, scrapped_date, scrapped_by, and org_id are required fields"
            });
        }

        const updateData = {
            asset_id,
            scrapped_date,
            scrapped_by,
            location: location || null,
            notes: notes || null,
            org_id
        };

        const result = await model.updateScrapAsset(id, updateData);
        
        res.status(200).json({
            success: true,
            message: "Scrap asset updated successfully",
            scrap_asset: result.rows[0]
        });
    } catch (err) {
        console.error("Error updating scrap asset:", err);
        res.status(500).json({ 
            success: false,
            error: "Failed to update scrap asset",
            message: err.message 
        });
    }
};

// DELETE /api/scrap-assets/:id - Delete scrap asset
const deleteScrapAsset = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if scrap asset exists
        const exists = await model.checkScrapAssetExists(id);
        if (exists.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Scrap asset not found"
            });
        }

        const result = await model.deleteScrapAsset(id);
        
        res.status(200).json({
            success: true,
            message: "Scrap asset deleted successfully",
            deleted_scrap_asset: result.rows[0]
        });
    } catch (err) {
        console.error("Error deleting scrap asset:", err);
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
    
    addScrapAsset,
    updateScrapAsset,
    deleteScrapAsset
};
