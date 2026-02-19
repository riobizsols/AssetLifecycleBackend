const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

const getAllMappings = async (orgId) => {
    const dbPool = getDb();
    const result = await dbPool.query(
        `SELECT 
            m.at_id, 
            at.text as asset_type_name,
            m.asset_id, 
            a.text as asset_name,
            COUNT(m.insp_check_id) as total_questions
         FROM "tblAATInspCheckList" m
         LEFT JOIN "tblAssetTypes" at ON m.at_id = at.asset_type_id AND m.org_id = at.org_id
         LEFT JOIN "tblAssets" a ON m.asset_id = a.asset_id AND m.org_id = a.org_id
         WHERE m.org_id = $1
         GROUP BY m.at_id, at.text, m.asset_id, a.text
         ORDER BY at.text, a.text`,
        [orgId]
    );
    return result.rows;
};

const getMappedChecklistsByAssetTypeAndAsset = async (assetTypeId, assetId, orgId) => {
    const dbPool = getDb();
    
    let query = `
        SELECT 
            m.aatic_id,
            m.at_id,
            m.asset_id,
            m.insp_check_id,
            m.expected_value,
            m.min_range,
            m.max_range,
            m.trigger_maintenance,
            m.org_id,
            m.created_by,
            m.created_on,
            m.changed_by,
            m.changed_on,
            c.response_type,
            CASE 
                WHEN c.response_type = 'QN' THEN 'IRTD_QN_001'
                ELSE 'IRTD_QL_YES_NO_001'
            END as irtd_id,
            c.inspection_text as question_text
        FROM "tblAATInspCheckList" m
        LEFT JOIN "tblInspCheckList" c ON m.insp_check_id = c.insp_check_id AND m.org_id = c.org_id
        WHERE m.at_id = $1 AND m.org_id = $2
    `;
    let params = [assetTypeId, orgId];
    
    if (assetId) {
        query += ` AND m.asset_id = $3`;
        params.push(assetId);
    } else {
        query += ` AND (m.asset_id IS NULL OR m.asset_id = '')`;
    }
    
    const result = await dbPool.query(query, params);
    return result.rows;
};

const saveMapping = async (assetTypeId, assetId, overrideData, orgId, userId) => {
    const dbPool = getDb();
    
    // Start a transaction
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Delete existing mappings for this asset type/asset combo
        let deleteQuery = `DELETE FROM "tblAATInspCheckList" WHERE at_id = $1 AND org_id = $2`;
        let deleteParams = [assetTypeId, orgId];
        
        if (assetId) {
            deleteQuery += ` AND asset_id = $3`;
            deleteParams.push(assetId);
        } else {
            deleteQuery += ` AND (asset_id IS NULL OR asset_id = '')`;
        }
        
        await client.query(deleteQuery, deleteParams);
        
        // 2. Insert new mappings
        if (overrideData && overrideData.length > 0) {
            for (const item of overrideData) {
                // Generate a custom ID for each mapping record
                const aaticId = await generateCustomId('aat_insp_checklist');
                
                await client.query(
                    `INSERT INTO "tblAATInspCheckList" 
                     (aatic_id, org_id, at_id, asset_id, insp_check_id, expected_value, min_range, max_range, trigger_maintenance, created_by, created_on)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
                    [
                        aaticId,
                        orgId, 
                        assetTypeId, 
                        assetId || null, 
                        item.insp_check_id || item.Insp_check_id, 
                        item.expected_value || item.Expected_Value, 
                        (item.min_range === "" || item.min_range === null || item.min_range === undefined) ? null : item.min_range, 
                        (item.max_range === "" || item.max_range === null || item.max_range === undefined) ? null : item.max_range, 
                        !!item.trigger_maintenance, 
                        userId
                    ]
                );
            }
        }
        
        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

const deleteMappingGroup = async (assetTypeId, assetId, orgId) => {
    const dbPool = getDb();
    
    let query = `DELETE FROM "tblAATInspCheckList" WHERE at_id = $1 AND org_id = $2`;
    let params = [assetTypeId, orgId];
    
    if (assetId) {
        query += ` AND asset_id = $3`;
        params.push(assetId);
    } else {
        query += ` AND (asset_id IS NULL OR asset_id = '')`;
    }
    
    const result = await dbPool.query(query, params);
    return result.rowCount > 0;
};

module.exports = {
    getAllMappings,
    getMappedChecklistsByAssetTypeAndAsset,
    saveMapping,
    deleteMappingGroup
};
