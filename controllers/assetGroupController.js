const model = require("../models/assetGroupModel");
const assetGroupLogger = require("../eventLoggers/assetGroupEventLogger");

// POST /api/asset-groups - Create new asset group
const createAssetGroup = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { text, asset_ids } = req.body;
        const org_id = req.user.org_id;
        const created_by = req.user.user_id;
        
        // Get user's branch information
        const userModel = require("../models/userModel");
        const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
        const userBranchId = userWithBranch?.branch_id;
        
        console.log('=== Asset Group Creation Debug ===');
        console.log('User org_id:', org_id);
        console.log('User branch_id:', userBranchId);
        
        // Get branch_code from tblBranches
        let userBranchCode = null;
        if (userBranchId) {
            const dbPool = req.db || require("../config/db");
            const branchQuery = `SELECT branch_code FROM "tblBranches" WHERE branch_id = $1`;

            const branchResult = await dbPool.query(branchQuery, [userBranchId]);
            if (branchResult.rows.length > 0) {
                userBranchCode = branchResult.rows[0].branch_code;
                console.log('User branch_code:', userBranchCode);
            } else {
                console.log('Branch not found for branch_id:', userBranchId);
            }
        }

        // Log API call
        assetGroupLogger.logCreateAssetGroupApiCalled({
            text,
            assetIds: asset_ids,
            orgId: org_id,
            requestData: { operation: 'create_asset_group' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        // Log validation step
        assetGroupLogger.logValidatingAssetGroupData({
            text,
            assetIds: asset_ids,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Validate required fields
        if (!text) {
            assetGroupLogger.logMissingGroupName({ userId }).catch(err => console.error('Logging error:', err));
            return res.status(400).json({ 
                error: "Group name (text) is required" 
            });
        }

        if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
            assetGroupLogger.logMissingAssetIds({ userId }).catch(err => console.error('Logging error:', err));
            return res.status(400).json({ 
                error: "At least one asset must be selected" 
            });
        }

        // Log creation step
        assetGroupLogger.logCreatingAssetGroup({
            text,
            assetIds: asset_ids,
            orgId: org_id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Create asset group with transaction
        const result = await model.createAssetGroup(org_id, userBranchCode, text, asset_ids, created_by);

        // Log success
        assetGroupLogger.logAssetGroupCreated({
            assetGroupId: result.asset_group_id,
            text,
            assetCount: asset_ids.length,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        res.status(201).json({
            message: "Asset group created successfully",
            asset_group: result
        });

    } catch (err) {
        console.error("Error creating asset group:", err);
        
        assetGroupLogger.logAssetGroupCreationError({
            text: req.body.text,
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
};

// GET /api/asset-groups - Get all asset groups
const getAllAssetGroups = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const org_id = req.user.org_id;
        
        // Get user's branch information
        const userModel = require("../models/userModel");
        const userWithBranch = await userModel.getUserWithBranch(req.user.user_id);
        const userBranchId = userWithBranch?.branch_id;
        
        console.log('=== Asset Group Listing Debug ===');
        console.log('User org_id:', org_id);
        console.log('User branch_id:', userBranchId);
        
        // Get branch_code from tblBranches
        let userBranchCode = null;
        if (userBranchId) {
            const dbPool = req.db || require("../config/db");
            const branchQuery = `SELECT branch_code FROM "tblBranches" WHERE branch_id = $1`;

            const branchResult = await dbPool.query(branchQuery, [userBranchId]);
            if (branchResult.rows.length > 0) {
                userBranchCode = branchResult.rows[0].branch_code;
                console.log('User branch_code:', userBranchCode);
            } else {
                console.log('Branch not found for branch_id:', userBranchId);
            }
        }
        
        // Log API call
        assetGroupLogger.logGetAllAssetGroupsApiCalled({
            requestData: { operation: 'get_all_asset_groups' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        // Log querying step
        assetGroupLogger.logQueryingAssetGroups({ userId }).catch(err => console.error('Logging error:', err));
        
        const result = await model.getAllAssetGroups(org_id, userBranchCode);
        
        // Log success
        assetGroupLogger.logAssetGroupsRetrieved({
            count: result.rows.length,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching asset groups:", err);
        
        assetGroupLogger.logAssetGroupsRetrievalError({
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ error: "Failed to fetch asset groups" });
    }
};

// GET /api/asset-groups/:id - Get asset group by ID
const getAssetGroupById = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { id } = req.params;
        
        // Log API call
        assetGroupLogger.logGetAssetGroupByIdApiCalled({
            assetGroupId: id,
            requestData: { operation: 'get_asset_group_by_id' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        // Log querying step
        assetGroupLogger.logQueryingAssetGroupById({
            assetGroupId: id,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        const result = await model.getAssetGroupById(id);
        
        if (!result.header) {
            assetGroupLogger.logAssetGroupNotFound({
                assetGroupId: id,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(404).json({ error: "Asset group not found" });
        }
        
        // Log success
        assetGroupLogger.logAssetGroupRetrieved({
            assetGroupId: id,
            userId
        }).catch(err => console.error('Logging error:', err));
        
        res.status(200).json(result);
    } catch (err) {
        console.error("Error fetching asset group:", err);
        
        assetGroupLogger.logAssetGroupRetrievalError({
            assetGroupId: req.params.id,
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ error: "Failed to fetch asset group" });
    }
};

// PUT /api/asset-groups/:id - Update asset group
const updateAssetGroup = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { id } = req.params;
        const { text, asset_ids } = req.body;
        const changed_by = req.user.user_id;

        // Log API call
        assetGroupLogger.logUpdateAssetGroupApiCalled({
            assetGroupId: id,
            text,
            assetIds: asset_ids,
            requestData: { operation: 'update_asset_group' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        // Log validation step
        assetGroupLogger.logValidatingUpdateData({
            assetGroupId: id,
            text,
            assetIds: asset_ids,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Validate required fields
        if (!text) {
            assetGroupLogger.logMissingGroupName({ userId }).catch(err => console.error('Logging error:', err));
            return res.status(400).json({ 
                error: "Group name (text) is required" 
            });
        }

        if (!asset_ids || !Array.isArray(asset_ids) || asset_ids.length === 0) {
            assetGroupLogger.logMissingAssetIds({ userId }).catch(err => console.error('Logging error:', err));
            return res.status(400).json({ 
                error: "At least one asset must be selected" 
            });
        }

        // Log checking existence step
        assetGroupLogger.logCheckingAssetGroupExists({
            assetGroupId: id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Check if asset group exists
        const existingGroup = await model.getAssetGroupById(id);
        if (!existingGroup.header) {
            assetGroupLogger.logAssetGroupNotFound({
                assetGroupId: id,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(404).json({ error: "Asset group not found" });
        }

        // Log updating step
        assetGroupLogger.logUpdatingAssetGroup({
            assetGroupId: id,
            text,
            assetIds: asset_ids,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Update asset group
        const result = await model.updateAssetGroup(id, text, asset_ids, changed_by);

        // Log success
        assetGroupLogger.logAssetGroupUpdated({
            assetGroupId: id,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        res.status(200).json({
            message: "Asset group updated successfully",
            asset_group: result
        });

    } catch (err) {
        console.error("Error updating asset group:", err);
        
        assetGroupLogger.logAssetGroupUpdateError({
            assetGroupId: req.params.id,
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
};

// DELETE /api/asset-groups/:id - Delete asset group
const deleteAssetGroup = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        const { id } = req.params;

        // Log API call
        assetGroupLogger.logDeleteAssetGroupApiCalled({
            assetGroupId: id,
            requestData: { operation: 'delete_asset_group' },
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        // Log checking existence step
        assetGroupLogger.logCheckingAssetGroupExists({
            assetGroupId: id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Check if asset group exists
        const existingGroup = await model.getAssetGroupById(id);
        if (!existingGroup.header) {
            assetGroupLogger.logAssetGroupNotFound({
                assetGroupId: id,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            return res.status(404).json({ error: "Asset group not found" });
        }

        // Log deleting step
        assetGroupLogger.logDeletingAssetGroup({
            assetGroupId: id,
            userId
        }).catch(err => console.error('Logging error:', err));

        // Delete asset group
        const result = await model.deleteAssetGroup(id);

        // Log success
        assetGroupLogger.logAssetGroupDeleted({
            assetGroupId: id,
            userId,
            duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));

        res.status(200).json({
            message: "Asset group deleted successfully",
            deleted_group: result.rows[0]
        });

    } catch (err) {
        console.error("Error deleting asset group:", err);
        
        assetGroupLogger.logAssetGroupDeletionError({
            assetGroupId: req.params.id,
            error: err,
            userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
};

module.exports = {
    createAssetGroup,
    getAllAssetGroups,
    getAssetGroupById,
    updateAssetGroup,
    deleteAssetGroup
};
