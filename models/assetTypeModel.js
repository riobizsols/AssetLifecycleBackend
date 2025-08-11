const db = require('../config/db');

const insertAssetType = async (org_id, asset_type_id, int_status, maint_required, assignment_type, inspection_required, group_required, created_by, text, is_child = false, parent_asset_type_id = null, maint_type_id = null, maint_lead_type = null) => {
    const query = `
        INSERT INTO "tblAssetTypes" (
            org_id, asset_type_id, int_status, maint_required, 
            assignment_type, inspection_required, group_required, created_by, 
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP, $9, $10, $11, $12, $13)
        RETURNING *
    `;
    
    const values = [
        org_id, asset_type_id, int_status, maint_required,
        assignment_type, inspection_required, group_required, created_by, text,
        is_child, parent_asset_type_id, maint_type_id, maint_lead_type
    ];
    
    return await db.query(query, values);
};

const getAllAssetTypes = async () => {
    const query = `
        SELECT 
            org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type
        FROM "tblAssetTypes"
        ORDER BY created_on DESC
    `;
    
    return await db.query(query);
};

const getAssetTypeById = async (asset_type_id) => {
    const query = `
        SELECT 
            org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type
        FROM "tblAssetTypes"
        WHERE asset_type_id = $1
    `;
    
    return await db.query(query, [asset_type_id]);
};

const updateAssetType = async (asset_type_id, updateData, changed_by) => {
    const {
        org_id, int_status, maint_required, assignment_type,
        inspection_required, group_required, text, is_child, parent_asset_type_id,
        maint_type_id, maint_lead_type
    } = updateData;
    
    const query = `
        UPDATE "tblAssetTypes"
        SET 
            org_id = $1, int_status = $2, maint_required = $3,
            assignment_type = $4, inspection_required = $5, group_required = $6,
            changed_by = $7, changed_on = CURRENT_TIMESTAMP, text = $8,
            is_child = $9, parent_asset_type_id = $10, maint_type_id = $11,
            maint_lead_type = $12
        WHERE asset_type_id = $13
        RETURNING *
    `;
    
    const values = [
        org_id, int_status, maint_required, assignment_type,
        inspection_required, group_required, changed_by, text,
        is_child, parent_asset_type_id, maint_type_id, maint_lead_type, asset_type_id
    ];
    
    return await db.query(query, values);
};

const checkAssetTypeExists = async (org_id, asset_type_id) => {
    const query = `
        SELECT asset_type_id FROM "tblAssetTypes"
        WHERE org_id = $1 AND asset_type_id = $2
    `;
    
    return await db.query(query, [org_id, asset_type_id]);
};

const checkAssetTypeReferences = async (asset_type_id) => {
    try {
        // Check only tblAssets
        const assetsQuery = `
            SELECT a.asset_id, a.text as asset_name
            FROM "tblAssets" a
            WHERE a.asset_type_id = $1
        `;
        const assetsResult = await db.query(assetsQuery, [asset_type_id]);

        // Return results
        return {
            rows: assetsResult.rows,
            assetCount: assetsResult.rows.length,
            deptAssetCount: 0 // We don't have department assets table
        };
    } catch (error) {
        console.error('Error in checkAssetTypeReferences:', error);
        throw error;
    }
};

const getParentAssetTypes = async () => {
    const query = `
        SELECT 
            asset_type_id,
            text,
            int_status
        FROM "tblAssetTypes"
        WHERE is_child = false
        AND int_status = 1
        ORDER BY text
    `;
    
    return await db.query(query);
};

const getAssetTypesByAssignmentType = async (assignment_type) => {
    const query = `
        SELECT 
            org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type, serial_num_format
        FROM "tblAssetTypes"
        WHERE assignment_type = $1
        AND int_status = 1
        ORDER BY text
    `;
    
    return await db.query(query, [assignment_type]);
};

const getAssetTypesByGroupRequired = async () => {
    const query = `
        SELECT 
            org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type
        FROM "tblAssetTypes"
        WHERE group_required = true
        AND int_status = 1
        ORDER BY text
    `;
    
    return await db.query(query);
};

const deleteAssetType = async (asset_type_id) => {
    try {
        const query = `
            DELETE FROM "tblAssetTypes"
            WHERE asset_type_id = $1
            RETURNING *
        `;
        
        return await db.query(query, [asset_type_id]);
    } catch (error) {
        console.error('Error in deleteAssetType:', error);
        throw error;
    }
};

module.exports = {
    insertAssetType,
    getAllAssetTypes,
    getAssetTypeById,
    updateAssetType,
    deleteAssetType,
    checkAssetTypeExists,
    checkAssetTypeReferences,
    getParentAssetTypes,
    getAssetTypesByAssignmentType,
    getAssetTypesByGroupRequired
}; 