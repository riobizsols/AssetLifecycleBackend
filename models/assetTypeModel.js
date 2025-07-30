const db = require('../config/db');

const insertAssetType = async (ext_id, org_id, asset_type_id, int_status, maint_required, assignment_type, inspection_required, group_required, created_by, text, is_child = false, parent_asset_type_id = null) => {
    const query = `
        INSERT INTO "tblAssetTypes" (
            ext_id, org_id, asset_type_id, int_status, maint_required, 
            assignment_type, inspection_required, group_required, created_by, 
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $9, CURRENT_TIMESTAMP, $10, $11, $12)
        RETURNING *
    `;
    
    const values = [
        ext_id, org_id, asset_type_id, int_status, maint_required,
        assignment_type, inspection_required, group_required, created_by, text,
        is_child, parent_asset_type_id
    ];
    
    return await db.query(query, values);
};

const getAllAssetTypes = async () => {
    const query = `
        SELECT 
            ext_id, org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id
        FROM "tblAssetTypes"
        ORDER BY created_on DESC
    `;
    
    return await db.query(query);
};

const getAssetTypeById = async (asset_type_id) => {
    const query = `
        SELECT 
            ext_id, org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id
        FROM "tblAssetTypes"
        WHERE asset_type_id = $1
    `;
    
    return await db.query(query, [asset_type_id]);
};

const updateAssetType = async (asset_type_id, updateData, changed_by) => {
    const {
        ext_id, org_id, int_status, maint_required, assignment_type,
        inspection_required, group_required, text, is_child, parent_asset_type_id
    } = updateData;
    
    const query = `
        UPDATE "tblAssetTypes"
        SET 
            ext_id = $1, org_id = $2, int_status = $3, maint_required = $4,
            assignment_type = $5, inspection_required = $6, group_required = $7,
            changed_by = $8, changed_on = CURRENT_TIMESTAMP, text = $9,
            is_child = $10, parent_asset_type_id = $11
        WHERE asset_type_id = $12
        RETURNING *
    `;
    
    const values = [
        ext_id, org_id, int_status, maint_required, assignment_type,
        inspection_required, group_required, changed_by, text,
        is_child, parent_asset_type_id, asset_type_id
    ];
    
    return await db.query(query, values);
};

const checkAssetTypeExists = async (ext_id, org_id) => {
    const query = `
        SELECT asset_type_id FROM "tblAssetTypes"
        WHERE ext_id = $1 AND org_id = $2
    `;
    
    return await db.query(query, [ext_id, org_id]);
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
    getParentAssetTypes
}; 