const db = require('../config/db');

// Simple counter for generating sequential IDs
let headerCounter = 0;
let detailCounter = 0;

// Generate asset group header ID directly
const generateAssetGroupHeaderId = async () => {
    const result = await db.query(`
        SELECT assetgroup_h_id 
        FROM "tblAssetGroup_H" 
        ORDER BY CAST(SUBSTRING(assetgroup_h_id FROM '\\d+$') AS INTEGER) DESC 
        LIMIT 1
    `);
    
    let nextNum = 1;
    if (result.rows.length > 0) {
        const lastId = result.rows[0].assetgroup_h_id;
        const match = lastId.match(/\d+/); // extract numeric part
        if (match) {
            nextNum = parseInt(match[0]) + 1;
        }
    }
    
    headerCounter = nextNum;
    return `AGH${String(nextNum).padStart(3, "0")}`;
};

// Generate asset group detail ID directly
const generateAssetGroupDetailId = async () => {
    const result = await db.query(`
        SELECT assetgroup_d_id 
        FROM "tblAssetGroup_D" 
        ORDER BY CAST(SUBSTRING(assetgroup_d_id FROM '\\d+$') AS INTEGER) DESC 
        LIMIT 1
    `);
    
    let nextNum = 1;
    if (result.rows.length > 0) {
        const lastId = result.rows[0].assetgroup_d_id;
        const match = lastId.match(/\d+/); // extract numeric part
        if (match) {
            nextNum = parseInt(match[0]) + 1;
        }
    }
    
    detailCounter = nextNum;
    return `AGD${String(nextNum).padStart(3, "0")}`;
};

// Generate sequential detail IDs without database queries
const generateSequentialDetailIds = (count) => {
    const ids = [];
    for (let i = 0; i < count; i++) {
        detailCounter++;
        ids.push(`AGD${String(detailCounter).padStart(3, "0")}`);
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
        const detailIds = generateSequentialDetailIds(asset_ids.length);
        
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
            a.purchased_on
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
        
        // Generate sequential detail IDs
        const detailIds = generateSequentialDetailIds(asset_ids.length);
        
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

// Delete asset group
const deleteAssetGroup = async (assetgroup_h_id) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
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
    deleteAssetGroup
};
