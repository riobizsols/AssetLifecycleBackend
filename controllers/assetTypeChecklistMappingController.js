const { 
    getAllMappings, 
    getMappedChecklistsByAssetTypeAndAsset, 
    saveMapping,
    deleteMappingGroup 
} = require('../models/assetTypeChecklistMappingModel');

const fetchAllMappings = async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const mapped = await getAllMappings(org_id);
        res.json({ success: true, data: mapped });
    } catch (error) {
        console.error('Error fetching all mappings:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch mappings', error: error.message });
    }
};

const getMappedChecklists = async (req, res) => {
    try {
        const { assetTypeId } = req.params;
        const { assetId } = req.query;
        const org_id = req.user.org_id;
        
        const mapped = await getMappedChecklistsByAssetTypeAndAsset(assetTypeId, assetId, org_id);
        
        res.json({
            success: true,
            data: mapped
        });
    } catch (error) {
        console.error('Error fetching mapped checklists:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch mapped checklists',
            error: error.message
        });
    }
};

const updateMapping = async (req, res) => {
    try {
        const { assetTypeId, assetId, overrideData } = req.body;
        const org_id = req.user.org_id;
        const user_id = req.user.user_id;
        
        if (!assetTypeId) {
            return res.status(400).json({
                success: false,
                message: 'Asset Type ID is required'
            });
        }
        
        await saveMapping(assetTypeId, assetId, overrideData, org_id, user_id);
        
        res.json({
            success: true,
            message: 'Mapping saved successfully'
        });
    } catch (error) {
        console.error('Error updating mapping:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save mapping',
            error: error.message
        });
    }
};

const removeMappingGroup = async (req, res) => {
    try {
        const { assetTypeId, assetId } = req.query;
        const org_id = req.user.org_id;
        
        if (!assetTypeId) {
            return res.status(400).json({
                success: false,
                message: 'Asset Type ID is required'
            });
        }
        
        await deleteMappingGroup(assetTypeId, assetId, org_id);
        
        res.json({
            success: true,
            message: 'Mapping group deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting mapping group:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete mapping group',
            error: error.message
        });
    }
};

module.exports = {
    fetchAllMappings,
    getMappedChecklists,
    updateMapping,
    removeMappingGroup
};
