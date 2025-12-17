const db = require('../config/db');
const { getDb: getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

// Helper function to get database connection (tenant pool or default)
const getDb = () => {
  const contextDb = getDbFromContext();
  return contextDb;
};

const insertAssetType = async (org_id, asset_type_id, int_status, maint_required, assignment_type, inspection_required, group_required, created_by, text, is_child = false, parent_asset_type_id = null, maint_type_id = null, maint_lead_type = null, depreciation_type = 'ND') => {
    const query = `
        INSERT INTO "tblAssetTypes" (
            org_id, asset_type_id, int_status, maint_required, 
            assignment_type, inspection_required, group_required, created_by, 
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type, last_gen_seq_no, depreciation_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP, $9, $10, $11, $12, $13, 0, $14)
        RETURNING *
    `;
    
    const values = [
        org_id, asset_type_id, int_status, maint_required,
        assignment_type, inspection_required, group_required, created_by, text,
        is_child, parent_asset_type_id, maint_type_id, maint_lead_type, depreciation_type
    ];
    
    const dbPool = getDb();
    return await dbPool.query(query, values);
};

const getAllAssetTypes = async (org_id = null) => {
    const dbPool = getDb();
    let query = `
        SELECT 
            org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type, last_gen_seq_no, depreciation_type
        FROM "tblAssetTypes"
    `;
    
    const params = [];
    if (org_id) {
        query += ` WHERE org_id = $1`;
        params.push(org_id);
    }
    
    query += ` ORDER BY created_on DESC`;
    
    return await dbPool.query(query, params);
};

const getAssetTypeById = async (asset_type_id) => {
    const query = `
        SELECT 
            org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type, last_gen_seq_no, depreciation_type
        FROM "tblAssetTypes"
        WHERE asset_type_id = $1
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [asset_type_id]);
};

const updateAssetType = async (asset_type_id, updateData, changed_by) => {
    const {
        org_id, int_status, maint_required, assignment_type,
        inspection_required, group_required, text, is_child, parent_asset_type_id,
        maint_type_id, maint_lead_type, depreciation_type
    } = updateData;
    
    const query = `
        UPDATE "tblAssetTypes"
        SET 
            org_id = $1, int_status = $2, maint_required = $3,
            assignment_type = $4, inspection_required = $5, group_required = $6,
            changed_by = $7, changed_on = CURRENT_TIMESTAMP, text = $8,
            is_child = $9, parent_asset_type_id = $10, maint_type_id = $11,
            maint_lead_type = $12, depreciation_type = $13
        WHERE asset_type_id = $14
        RETURNING *
    `;
    
    const values = [
        org_id, int_status, maint_required, assignment_type,
        inspection_required, group_required, changed_by, text,
        is_child, parent_asset_type_id, maint_type_id, maint_lead_type, depreciation_type, asset_type_id
    ];
    
    const dbPool = getDb();
    return await dbPool.query(query, values);
};

const checkAssetTypeExists = async (org_id, asset_type_id) => {
    const query = `
        SELECT asset_type_id FROM "tblAssetTypes"
        WHERE org_id = $1 AND asset_type_id = $2
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [org_id, asset_type_id]);
};

const checkAssetTypeReferences = async (asset_type_id) => {
    try {
        const dbPool = getDb();
        // Check only tblAssets
        const assetsQuery = `
            SELECT a.asset_id, a.text as asset_name
            FROM "tblAssets" a
            WHERE a.asset_type_id = $1
        `;
        const assetsResult = await dbPool.query(assetsQuery, [asset_type_id]);

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
    
    const dbPool = getDb();
    return await dbPool.query(query);
};

const getAssetTypesByAssignmentType = async (assignment_type) => {
    const query = `
        SELECT 
            org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type, serial_num_format, depreciation_type
        FROM "tblAssetTypes"
        WHERE assignment_type = $1
        AND int_status = 1
        ORDER BY text
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [assignment_type]);
};

const getAssetTypesByGroupRequired = async () => {
    const query = `
        SELECT 
            org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type, depreciation_type
        FROM "tblAssetTypes"
        WHERE group_required = true
        AND int_status = 1
        ORDER BY text
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query);
};

const getAssetTypesByMaintRequired = async () => {
    const query = `
        SELECT 
            org_id, asset_type_id, int_status, maint_required,
            assignment_type, inspection_required, group_required, created_by,
            created_on, changed_by, changed_on, text, is_child, parent_asset_type_id,
            maint_type_id, maint_lead_type, depreciation_type
        FROM "tblAssetTypes"
        WHERE int_status = 1
        ORDER BY text
    `;
    
    // maint_required = true AND
    const dbPool = getDb();
    return await dbPool.query(query);
};

const deleteAssetType = async (asset_type_id) => {
    try {
        const query = `
            DELETE FROM "tblAssetTypes"
            WHERE asset_type_id = $1
            RETURNING *
        `;
        
        const dbPool = getDb();
        return await dbPool.query(query, [asset_type_id]);
    } catch (error) {
        console.error('Error in deleteAssetType:', error);
        throw error;
    }
};
    
// Property mapping functions
const mapAssetTypeToProperties = async (asset_type_id, property_ids, org_id, created_by) => {
    try {
        const dbPool = getDb();
        console.log('🔍 mapAssetTypeToProperties called with:', {
            asset_type_id,
            property_ids,
            org_id,
            created_by
        });

        // First, delete existing mappings for this asset type
        console.log('🗑️ Deleting existing mappings for asset type:', asset_type_id);
        await dbPool.query(
            'DELETE FROM "tblAssetTypeProps" WHERE asset_type_id = $1',
            [asset_type_id]
        );

        // Insert new mappings sequentially to avoid ID conflicts
        if (property_ids && property_ids.length > 0) {
            console.log(`📝 Inserting ${property_ids.length} property mappings...`);
            
            for (let index = 0; index < property_ids.length; index++) {
                const prop_id = property_ids[index];
                console.log(`📝 Processing property ${index + 1}/${property_ids.length}: ${prop_id}`);
                const asset_type_prop_id = await generateCustomId('atp', 3);
                console.log(`🔢 Generated asset_type_prop_id: ${asset_type_prop_id}`);
                
                const query = `
                    INSERT INTO "tblAssetTypeProps" (
                        asset_type_prop_id, asset_type_id, prop_id, org_id
                    ) VALUES ($1, $2, $3, $4)
                `;
                console.log('📝 Executing insert query with values:', [asset_type_prop_id, asset_type_id, prop_id, org_id]);
                await dbPool.query(query, [asset_type_prop_id, asset_type_id, prop_id, org_id]);
                console.log(`✅ Property mapping ${index + 1} inserted successfully`);
            }
            
            console.log('✅ All property mappings inserted successfully');
        } else {
            console.log('⚠️ No property IDs provided for mapping');
        }

        return { success: true };
    } catch (error) {
        console.error('❌ Error mapping asset type to properties:', error);
        throw error;
    }
};

const getAssetTypeProperties = async (asset_type_id, org_id) => {
    try {
        console.log('🔍 Fetching properties for asset type:', asset_type_id, 'org:', org_id);
        
        const query = `
            SELECT 
                p.prop_id,
                p.property,
                p.int_status,
                atp.asset_type_prop_id
            FROM "tblProps" p
            INNER JOIN "tblAssetTypeProps" atp ON p.prop_id = atp.prop_id
            WHERE atp.asset_type_id = $1 
            AND p.org_id = $2 
            AND p.int_status = 1
            ORDER BY p.property
        `;
        
        const dbPool = getDb();
        const result = await dbPool.query(query, [asset_type_id, org_id]);
        console.log('✅ Found properties:', result.rows.length);
        console.log('Properties:', result.rows);
        return result.rows;
    } catch (error) {
        console.error('❌ Error fetching asset type properties:', error);
        throw error;
    }
};

const getAllProperties = async (org_id) => {
    try {
        const dbPool = getDb();
        const query = `
            SELECT 
                prop_id,
                property,
                int_status
            FROM "tblProps"
            WHERE org_id = $1 
            AND int_status = 1
            ORDER BY property
        `;
        
        const result = await dbPool.query(query, [org_id]);
        return result.rows;
    } catch (error) {
        console.error('Error fetching all properties:', error);
        throw error;
    }
};

// Add individual property to asset type (without deleting existing ones)
const addAssetTypeProperty = async (asset_type_id, prop_id, org_id, created_by) => {
    try {
        console.log('➕ Adding individual property to asset type:', { asset_type_id, prop_id, org_id });
        
        const dbPool = getDb();
        // Check if mapping already exists
        const existingCheck = await dbPool.query(`
            SELECT asset_type_prop_id FROM "tblAssetTypeProps" 
            WHERE asset_type_id = $1 AND prop_id = $2
        `, [asset_type_id, prop_id]);
        
        if (existingCheck.rows.length > 0) {
            console.log('⚠️ Property mapping already exists');
            return { success: false, message: 'Property already mapped to this asset type' };
        }
        
        // Generate new asset_type_prop_id
        const asset_type_prop_id = await generateCustomId('atp', 3);
        console.log('🔢 Generated asset_type_prop_id:', asset_type_prop_id);
        
        // Insert new mapping
        const query = `
            INSERT INTO "tblAssetTypeProps" (
                asset_type_prop_id, asset_type_id, prop_id, org_id
            ) VALUES ($1, $2, $3, $4)
        `;
        
        await dbPool.query(query, [asset_type_prop_id, asset_type_id, prop_id, org_id]);
        console.log('✅ Property mapping added successfully');
        
        return { success: true, asset_type_prop_id };
    } catch (error) {
        console.error('❌ Error adding asset type property mapping:', error);
        throw error;
    }
};

// Delete individual asset type property mapping
const deleteAssetTypeProperty = async (asset_type_prop_id) => {
    try {
        console.log('🗑️ Deleting asset type property mapping:', asset_type_prop_id);
        
        const query = `
            DELETE FROM "tblAssetTypeProps" 
            WHERE asset_type_prop_id = $1
            RETURNING *
        `;
        
        const dbPool = getDb();
        const result = await dbPool.query(query, [asset_type_prop_id]);
        console.log('✅ Asset type property mapping deleted:', result.rows.length > 0 ? 'Success' : 'Not found');
        
        return result;
    } catch (error) {
        console.error('❌ Error deleting asset type property mapping:', error);
        throw error;
    }
};

// Get asset type by text/name
const getAssetTypeByText = async (text, org_id) => {
    const query = `
        SELECT asset_type_id, text, org_id
        FROM "tblAssetTypes"
        WHERE text = $1 AND org_id = $2
    `;
    
    const dbPool = getDb();
    return await dbPool.query(query, [text, org_id]);
};

// Check if property exists
const checkPropertyExists = async (prop_id, org_id) => {
    const dbPool = getDb();
    const query = `
        SELECT prop_id
        FROM "tblProps"
        WHERE prop_id = $1 AND org_id = $2
    `;
    
    return await dbPool.query(query, [prop_id, org_id]);
};

// Delete all property mappings for an asset type
const deleteAssetTypePropertyMappings = async (asset_type_id) => {
    const dbPool = getDb();
    const query = `
        DELETE FROM "tblAssetTypeProps"
        WHERE asset_type_id = $1
    `;
    
    return await dbPool.query(query, [asset_type_id]);
};

// Insert maintenance frequency into tblATMaintFreq
const insertMaintenanceFrequency = async (asset_type_id, frequency, uom, maint_type_id, maintained_by, text, org_id, created_by) => {
    try {
        const dbPool = getDb();
        
        // Generate at_main_freq_id in format ATMF001
        const at_main_freq_id = await generateCustomId('atmf', 3);
        
        const query = `
            INSERT INTO "tblATMaintFreq" (
                at_main_freq_id,
                asset_type_id,
                frequency,
                uom,
                text,
                maintained_by,
                maint_type_id,
                int_status,
                org_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
            RETURNING *
        `;
        
        const values = [
            at_main_freq_id,
            asset_type_id,
            frequency,
            uom,
            text || `${frequency} ${uom}`,
            maintained_by || 'Internal',
            maint_type_id,
            org_id
        ];
        
        const result = await dbPool.query(query, values);
        return result;
    } catch (error) {
        console.error('Error inserting maintenance frequency:', error);
        throw error;
    }
};

// Get maintenance frequency for asset type
const getMaintenanceFrequency = async (asset_type_id) => {
    try {
        const dbPool = getDb();
        const query = `
            SELECT 
                at_main_freq_id,
                asset_type_id,
                frequency,
                uom,
                text,
                maintained_by,
                maint_type_id,
                int_status,
                org_id
            FROM "tblATMaintFreq"
            WHERE asset_type_id = $1
            ORDER BY at_main_freq_id
            LIMIT 1
        `;
        
        const result = await dbPool.query(query, [asset_type_id]);
        return result;
    } catch (error) {
        console.error('Error getting maintenance frequency:', error);
        throw error;
    }
};

// Update maintenance frequency for asset type
const updateMaintenanceFrequency = async (asset_type_id, frequency, uom, maint_type_id, maintained_by, text, org_id) => {
    try {
        const dbPool = getDb();
        
        // Check if frequency exists
        const existing = await getMaintenanceFrequency(asset_type_id);
        
        if (existing.rows.length > 0) {
            // Update existing frequency
            const at_main_freq_id = existing.rows[0].at_main_freq_id;
            const query = `
                UPDATE "tblATMaintFreq"
                SET 
                    frequency = $1,
                    uom = $2,
                    text = $3,
                    maintained_by = $4,
                    maint_type_id = $5,
                    int_status = 1
                WHERE at_main_freq_id = $6
                RETURNING *
            `;
            
            const values = [
                frequency,
                uom,
                text || `${frequency} ${uom}`,
                maintained_by || 'Internal',
                maint_type_id,
                at_main_freq_id
            ];
            
            const result = await dbPool.query(query, values);
            return result;
        } else {
            // Insert new frequency
            return await insertMaintenanceFrequency(asset_type_id, frequency, uom, maint_type_id, maintained_by, text, org_id, null);
        }
    } catch (error) {
        console.error('Error updating maintenance frequency:', error);
        throw error;
    }
};

// Delete maintenance frequency for asset type
const deleteMaintenanceFrequency = async (asset_type_id) => {
    try {
        const dbPool = getDb();
        const query = `
            DELETE FROM "tblATMaintFreq"
            WHERE asset_type_id = $1
            RETURNING *
        `;
        
        const result = await dbPool.query(query, [asset_type_id]);
        return result;
    } catch (error) {
        console.error('Error deleting maintenance frequency:', error);
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
    getAssetTypesByGroupRequired,
    getAssetTypesByMaintRequired,
    mapAssetTypeToProperties,
    getAssetTypeProperties,
    getAllProperties,
    addAssetTypeProperty,
    deleteAssetTypeProperty,
    getAssetTypeByText,
    checkPropertyExists,
    deleteAssetTypePropertyMappings,
    insertMaintenanceFrequency,
    getMaintenanceFrequency,
    updateMaintenanceFrequency,
    deleteMaintenanceFrequency
}; 