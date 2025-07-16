const db = require('../config/db');

const insertAssetType = async (ext_id, org_id, asset_type_id, int_status, maintenance_schedule, assignment_type, inspection_required, group_required, created_by, text) => {
    const query = `
        INSERT INTO "tblAssetTypes" (
            ext_id, org_id, asset_type_id, int_status, maintenance_schedule, 
            assignment_type, inspection_required, group_required, created_by, 
            created_on, changed_by, changed_on, text
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $9, CURRENT_TIMESTAMP, $10)
        RETURNING *
    `;
    
    const values = [
        ext_id, org_id, asset_type_id, int_status, maintenance_schedule,
        assignment_type, inspection_required, group_required, created_by, text
    ];
    
    return await db.query(query, values);
};

const getAllAssetTypes = async () => {
    const query = `
        SELECT 
            ext_id, org_id, asset_type_id, int_status, maintenance_schedule,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text
        FROM "tblAssetTypes"
        ORDER BY created_on DESC
    `;
    
    return await db.query(query);
};

const getAssetTypeById = async (asset_type_id) => {
    const query = `
        SELECT 
            ext_id, org_id, asset_type_id, int_status, maintenance_schedule,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text
        FROM "tblAssetTypes"
        WHERE asset_type_id = $1
    `;
    
    return await db.query(query, [asset_type_id]);
};

const updateAssetType = async (asset_type_id, updateData, changed_by) => {
    const {
        ext_id, org_id, int_status, maintenance_schedule, assignment_type,
        inspection_required, group_required, text
    } = updateData;
    
    const query = `
        UPDATE "tblAssetTypes"
        SET 
            ext_id = $1, org_id = $2, int_status = $3, maintenance_schedule = $4,
            assignment_type = $5, inspection_required = $6, group_required = $7,
            changed_by = $8, changed_on = CURRENT_TIMESTAMP, text = $9
        WHERE asset_type_id = $10
        RETURNING *
    `;
    
    const values = [
        ext_id, org_id, int_status, maintenance_schedule, assignment_type,
        inspection_required, group_required, changed_by, text, asset_type_id
    ];
    
    return await db.query(query, values);
};

const deleteAssetType = async (asset_type_id) => {
    const query = `
        DELETE FROM "tblAssetTypes"
        WHERE asset_type_id = $1
        RETURNING *
    `;
    
    return await db.query(query, [asset_type_id]);
};

const checkAssetTypeExists = async (ext_id, org_id) => {
    const query = `
        SELECT asset_type_id FROM "tblAssetTypes"
        WHERE ext_id = $1 AND org_id = $2
    `;
    
    return await db.query(query, [ext_id, org_id]);
};

module.exports = {
    insertAssetType,
    getAllAssetTypes,
    getAssetTypeById,
    updateAssetType,
    deleteAssetType,
    checkAssetTypeExists
}; 