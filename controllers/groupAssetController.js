const model = require("../models/groupAssetModel");

// GET /api/group-assets/available/:asset_type_id - Get available assets by asset type
const getAvailableAssetsByAssetType = async (req, res) => {
    try {
        const { asset_type_id } = req.params;
        
        if (!asset_type_id) {
            return res.status(400).json({ 
                error: "Asset type ID is required" 
            });
        }

        // Get user's org_id and branch_id from the authenticated request
        const org_id = req.user?.org_id || null;
        const branch_id = req.user?.branch_id || null;

        console.log(`[getAvailableAssetsByAssetType] Fetching assets for asset_type_id: ${asset_type_id}, org_id: ${org_id}, branch_id: ${branch_id}`);
        
        const result = await model.getAvailableAssetsByAssetType(asset_type_id, org_id, branch_id);
        
        // Verify that all returned assets match the requested asset type
        const mismatchedAssets = result.rows.filter(asset => asset.asset_type_id !== asset_type_id);
        if (mismatchedAssets.length > 0) {
            console.error(`[getAvailableAssetsByAssetType] ERROR: Found ${mismatchedAssets.length} assets with mismatched asset_type_id!`);
            console.error(`[getAvailableAssetsByAssetType] Requested: ${asset_type_id}, Mismatched assets:`, mismatchedAssets.map(a => ({ asset_id: a.asset_id, asset_type_id: a.asset_type_id })));
        }
        
        // Filter out any mismatched assets as a safety measure
        const filteredAssets = result.rows.filter(asset => asset.asset_type_id === asset_type_id);
        
        // Also verify org_id and branch_id match (additional safety check)
        const orgMismatched = filteredAssets.filter(asset => org_id && asset.org_id !== org_id);
        const branchMismatched = filteredAssets.filter(asset => branch_id && asset.branch_id !== branch_id);
        
        if (orgMismatched.length > 0) {
            console.error(`[getAvailableAssetsByAssetType] ERROR: Found ${orgMismatched.length} assets with mismatched org_id!`);
        }
        if (branchMismatched.length > 0) {
            console.error(`[getAvailableAssetsByAssetType] ERROR: Found ${branchMismatched.length} assets with mismatched branch_id!`);
        }
        
        // Final filter for org_id and branch_id
        const finalFilteredAssets = filteredAssets.filter(asset => {
            const orgMatch = !org_id || asset.org_id === org_id;
            const branchMatch = !branch_id || asset.branch_id === branch_id;
            return orgMatch && branchMatch;
        });
        
        if (finalFilteredAssets.length !== filteredAssets.length) {
            console.warn(`[getAvailableAssetsByAssetType] Filtered out ${filteredAssets.length - finalFilteredAssets.length} assets due to org/branch mismatch`);
        }
        
        res.status(200).json({
            message: `Found ${finalFilteredAssets.length} available assets for asset type ${asset_type_id}`,
            asset_type_id: asset_type_id,
            org_id: org_id,
            branch_id: branch_id,
            count: finalFilteredAssets.length,
            assets: finalFilteredAssets
        });

    } catch (err) {
        console.error("Error fetching available assets by asset type:", err);
        res.status(500).json({ error: "Failed to fetch available assets" });
    }
};

// GET /api/group-assets/available - Get all available assets
const getAllAvailableAssets = async (req, res) => {
    try {
        const result = await model.getAllAvailableAssets();
        
        res.status(200).json({
            message: `Found ${result.rows.length} available assets for grouping`,
            count: result.rows.length,
            assets: result.rows
        });

    } catch (err) {
        console.error("Error fetching all available assets:", err);
        res.status(500).json({ error: "Failed to fetch available assets" });
    }
};

// GET /api/group-assets/available/:asset_type_id/filtered - Get available assets with filters
const getAvailableAssetsWithFilters = async (req, res) => {
    try {
        const { asset_type_id } = req.params;
        const { branch_id, vendor_id, expiring_soon, search } = req.query;
        
        if (!asset_type_id) {
            return res.status(400).json({ 
                error: "Asset type ID is required" 
            });
        }

        // Build filters object
        const filters = {};
        if (branch_id) filters.branch_id = branch_id;
        if (vendor_id) filters.vendor_id = vendor_id;
        if (expiring_soon) filters.expiring_soon = parseInt(expiring_soon);
        if (search) filters.search = search;

        const result = await model.getAvailableAssetsByAssetTypeWithFilters(asset_type_id, filters);
        
        res.status(200).json({
            message: `Found ${result.rows.length} available assets for asset type ${asset_type_id} with applied filters`,
            asset_type_id: asset_type_id,
            filters: filters,
            count: result.rows.length,
            assets: result.rows
        });

    } catch (err) {
        console.error("Error fetching available assets with filters:", err);
        res.status(500).json({ error: "Failed to fetch available assets" });
    }
};

// GET /api/group-assets/available/:asset_type_id/count - Get count of available assets
const getAvailableAssetsCount = async (req, res) => {
    try {
        const { asset_type_id } = req.params;
        
        if (!asset_type_id) {
            return res.status(400).json({ 
                error: "Asset type ID is required" 
            });
        }

        const result = await model.getAvailableAssetsCountByAssetType(asset_type_id);
        
        res.status(200).json({
            message: `Available assets count for asset type ${asset_type_id}`,
            asset_type_id: asset_type_id,
            count: parseInt(result.rows[0].count)
        });

    } catch (err) {
        console.error("Error fetching available assets count:", err);
        res.status(500).json({ error: "Failed to fetch available assets count" });
    }
};

// GET /api/group-assets/check/:asset_id - Check if asset is available for grouping
const checkAssetAvailability = async (req, res) => {
    try {
        const { asset_id } = req.params;
        
        if (!asset_id) {
            return res.status(400).json({ 
                error: "Asset ID is required" 
            });
        }

        const result = await model.isAssetAvailableForGrouping(asset_id);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: "Asset not found" 
            });
        }

        const asset = result.rows[0];
        
        res.status(200).json({
            message: asset.is_available ? "Asset is available for grouping" : "Asset is already in a group",
            asset_id: asset_id,
            asset_name: asset.text,
            current_status: asset.current_status,
            is_available: asset.is_available
        });

    } catch (err) {
        console.error("Error checking asset availability:", err);
        res.status(500).json({ error: "Failed to check asset availability" });
    }
};

// GET /api/group-assets/available-by-type/:asset_type_id - Get available assets by asset type (detailed)
const getAvailableAssetsByAssetTypeDetailed = async (req, res) => {
    try {
        const { asset_type_id } = req.params;
        const { include_expiry_info = 'true' } = req.query;
        
        if (!asset_type_id) {
            return res.status(400).json({ 
                error: "Asset type ID is required" 
            });
        }

        const result = await model.getAvailableAssetsByAssetType(asset_type_id);
        
        // Process assets to add additional information
        const processedAssets = result.rows.map(asset => {
            const processedAsset = {
                ...asset,
                is_available: true, // All assets returned are available
                can_be_grouped: asset.current_status === 'Active'
            };

            // Add expiry warning if enabled
            if (include_expiry_info === 'true' && asset.days_until_expiry !== null) {
                if (asset.days_until_expiry <= 0) {
                    processedAsset.expiry_warning = 'EXPIRED';
                } else if (asset.days_until_expiry <= 30) {
                    processedAsset.expiry_warning = 'EXPIRING_SOON';
                } else {
                    processedAsset.expiry_warning = 'OK';
                }
            }

            return processedAsset;
        });

        res.status(200).json({
            message: `Found ${processedAssets.length} available assets for asset type ${asset_type_id}`,
            asset_type_id: asset_type_id,
            asset_type_name: processedAssets.length > 0 ? processedAssets[0].asset_type_name : null,
            count: processedAssets.length,
            assets: processedAssets
        });

    } catch (err) {
        console.error("Error fetching available assets by asset type (detailed):", err);
        res.status(500).json({ error: "Failed to fetch available assets" });
    }
};

module.exports = {
    getAvailableAssetsByAssetType,
    getAllAvailableAssets,
    getAvailableAssetsWithFilters,
    getAvailableAssetsCount,
    checkAssetAvailability,
    getAvailableAssetsByAssetTypeDetailed
};
