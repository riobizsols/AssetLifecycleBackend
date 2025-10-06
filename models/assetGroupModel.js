const db = require('../config/db');
const { generateCustomId } = require('../utils/idGenerator');

// Generate asset group header ID using centralized generator
const generateAssetGroupHeaderId = async () => {
    return await generateCustomId('asset_group_h', 3);
};

// Generate asset group detail ID using centralized generator
const generateAssetGroupDetailId = async () => {
    return await generateCustomId('asset_group_d', 3);
};

// Generate sequential detail IDs using centralized generator
const generateSequentialDetailIds = async (count) => {
    const ids = [];
    for (let i = 0; i < count; i++) {
        const id = await generateCustomId('asset_group_d', 3);
        ids.push(id);
    }
    return ids;
};

// Create asset group header
const createAssetGroupHeader = async (org_id, assetgroup_h_id, text, created_by) => {
    const query = `
        INSERT INTO "tblAssetGroup_H" (
            assetgroup_h_id, org_id, text, created_by, created_on, changed_by, changed_on
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP)
        RETURNING *
    `;
    
    const values = [assetgroup_h_id, org_id, text, created_by];
    return await db.query(query, values);
};

// Create asset group detail
const createAssetGroupDetail = async (assetgroup_d_id, assetgroup_h_id, asset_id) => {
    const query = `
        INSERT INTO "tblAssetGroup_D" (
            assetgroup_d_id, assetgroup_h_id, asset_id
        ) VALUES ($1, $2, $3)
        RETURNING *
    `;
    
    const values = [assetgroup_d_id, assetgroup_h_id, asset_id];
    return await db.query(query, values);
};

// Create asset group with multiple assets (transaction)
const createAssetGroup = async (org_id, text, asset_ids, created_by) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Generate asset group header ID
        let assetgroup_h_id = await generateAssetGroupHeaderId();
        
        // Insert header
        const headerResult = await client.query(`
            INSERT INTO "tblAssetGroup_H" (
                assetgroup_h_id, org_id, text, created_by, created_on, changed_by, changed_on
            ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP)
            RETURNING *
        `, [assetgroup_h_id, org_id, text, created_by]);
        
        // Generate sequential detail IDs
        const detailIds = await generateSequentialDetailIds(asset_ids.length);
        
        // Insert details for each asset
        const detailResults = [];
        for (let i = 0; i < asset_ids.length; i++) {
            const detailResult = await client.query(`
                INSERT INTO "tblAssetGroup_D" (
                    assetgroup_d_id, assetgroup_h_id, asset_id
                ) VALUES ($1, $2, $3)
                RETURNING *
            `, [detailIds[i], assetgroup_h_id, asset_ids[i]]);
            
            detailResults.push(detailResult.rows[0]);
        }
        
        // Update group_id in tblAssets for all assets in this group
        await updateAssetsGroupId(client, asset_ids, assetgroup_h_id);
        
        await client.query('COMMIT');
        
        return {
            header: headerResult.rows[0],
            details: detailResults
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Get all asset groups
const getAllAssetGroups = async () => {
    const query = `
        SELECT 
            h.assetgroup_h_id,
            h.org_id,
            h.text,
            h.created_by,
            h.created_on,
            h.changed_by,
            h.changed_on,
            COUNT(d.asset_id) as asset_count
        FROM "tblAssetGroup_H" h
        LEFT JOIN "tblAssetGroup_D" d ON h.assetgroup_h_id = d.assetgroup_h_id
        GROUP BY h.assetgroup_h_id, h.org_id, h.text, h.created_by, h.created_on, h.changed_by, h.changed_on
        ORDER BY h.created_on DESC
    `;
    
    return await db.query(query);
};

// Get asset group by ID with details
const getAssetGroupById = async (assetgroup_h_id) => {
    const headerQuery = `
        SELECT * FROM "tblAssetGroup_H"
        WHERE assetgroup_h_id = $1
    `;
    
    const detailQuery = `
        SELECT 
            d.assetgroup_d_id,
            d.assetgroup_h_id,
            d.asset_id,
            a.text as asset_name,
            a.description,
            a.purchased_on,
            a.asset_type_id
        FROM "tblAssetGroup_D" d
        LEFT JOIN "tblAssets" a ON d.asset_id = a.asset_id
        WHERE d.assetgroup_h_id = $1
    `;
    
    const headerResult = await db.query(headerQuery, [assetgroup_h_id]);
    const detailResult = await db.query(detailQuery, [assetgroup_h_id]);
    
    return {
        header: headerResult.rows[0],
        details: detailResult.rows
    };
};

// Update asset group
const updateAssetGroup = async (assetgroup_h_id, text, asset_ids, changed_by) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get current asset IDs in this group
        const currentAssetIds = await getAssetIdsInGroup(client, assetgroup_h_id);
        
        // Update header
        const headerResult = await client.query(`
            UPDATE "tblAssetGroup_H"
            SET text = $1, changed_by = $2, changed_on = CURRENT_TIMESTAMP
            WHERE assetgroup_h_id = $3
            RETURNING *
        `, [text, changed_by, assetgroup_h_id]);
        
        // Delete existing details
        await client.query(`
            DELETE FROM "tblAssetGroup_D"
            WHERE assetgroup_h_id = $1
        `, [assetgroup_h_id]);
        
        // Clear group_id from assets that are no longer in this group
        const removedAssetIds = currentAssetIds.filter(id => !asset_ids.includes(id));
        if (removedAssetIds.length > 0) {
            await clearAssetsGroupId(client, removedAssetIds);
        }
        
        // Generate sequential detail IDs
        const detailIds = await generateSequentialDetailIds(asset_ids.length);
        
        // Insert new details
        const detailResults = [];
        for (let i = 0; i < asset_ids.length; i++) {
            const detailResult = await client.query(`
                INSERT INTO "tblAssetGroup_D" (
                    assetgroup_d_id, assetgroup_h_id, asset_id
                ) VALUES ($1, $2, $3)
                RETURNING *
            `, [detailIds[i], assetgroup_h_id, asset_ids[i]]);
            
            detailResults.push(detailResult.rows[0]);
        }
        
        // Update group_id in tblAssets for all assets in this group
        await updateAssetsGroupId(client, asset_ids, assetgroup_h_id);
        
        await client.query('COMMIT');
        
        return {
            header: headerResult.rows[0],
            details: detailResults
        };
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Update group_id in tblAssets when assets are added to a group
const updateAssetsGroupId = async (client, asset_ids, group_id) => {
    if (!asset_ids || asset_ids.length === 0) return;
    
    const placeholders = asset_ids.map((_, index) => `$${index + 2}`).join(',');
    const query = `
        UPDATE "tblAssets"
        SET group_id = $1, changed_on = CURRENT_TIMESTAMP
        WHERE asset_id IN (${placeholders})
    `;
    
    const values = [group_id, ...asset_ids];
    await client.query(query, values);
};

// Clear group_id in tblAssets when assets are removed from a group
const clearAssetsGroupId = async (client, asset_ids) => {
    if (!asset_ids || asset_ids.length === 0) return;
    
    const placeholders = asset_ids.map((_, index) => `$${index + 1}`).join(',');
    const query = `
        UPDATE "tblAssets"
        SET group_id = NULL, changed_on = CURRENT_TIMESTAMP
        WHERE asset_id IN (${placeholders})
    `;
    
    await client.query(query, asset_ids);
};

// Get asset IDs that are currently in a group
const getAssetIdsInGroup = async (client, assetgroup_h_id) => {
    const query = `
        SELECT asset_id FROM "tblAssetGroup_D"
        WHERE assetgroup_h_id = $1
    `;
    
    const result = await client.query(query, [assetgroup_h_id]);
    return result.rows.map(row => row.asset_id);
};

// Delete asset group
const deleteAssetGroup = async (assetgroup_h_id) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get asset IDs that are currently in this group
        const currentAssetIds = await getAssetIdsInGroup(client, assetgroup_h_id);
        
        // Clear group_id from tblAssets for all assets in this group
        if (currentAssetIds.length > 0) {
            await clearAssetsGroupId(client, currentAssetIds);
        }
        
        // Delete details first
        await client.query(`
            DELETE FROM "tblAssetGroup_D"
            WHERE assetgroup_h_id = $1
        `, [assetgroup_h_id]);
        
        // Delete header
        const result = await client.query(`
            DELETE FROM "tblAssetGroup_H"
            WHERE assetgroup_h_id = $1
            RETURNING *
        `, [assetgroup_h_id]);
        
        await client.query('COMMIT');
        return result;
        
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    createAssetGroupHeader,
    createAssetGroupDetail,
    createAssetGroup,
    getAllAssetGroups,
    getAssetGroupById,
    updateAssetGroup,
    deleteAssetGroup,
    updateAssetsGroupId,
    clearAssetsGroupId,
    getAssetIdsInGroup
};
