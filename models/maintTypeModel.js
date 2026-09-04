const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


const getAllMaintTypes = async (orgId = null) => {
    let query = `
        SELECT 
            maint_type_id,
            org_id,
            text,
            int_status
        FROM "tblMaintTypes"
    `;
    
    const params = [];
    const conditions = [];
    
    // Filter by int_status = 1 (numeric type in database)
    conditions.push(`int_status = 1`);
    
    if (orgId) {
        // Shared catalog IDs (MT001–MT004) are global by primary key but stored with a
        // single org_id. Always expose them so every tenant can pick a category.
        params.push(orgId);
        conditions.push(`(
          org_id = $${params.length}
          OR maint_type_id IN ('MT001', 'MT002', 'MT003', 'MT004')
        )`);
    }
    
    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY text ASC`;
    
    const dbPool = getDb();
    return await dbPool.query(query, params);
};

const getMaintTypeById = async (maint_type_id) => {
    const query = `
        SELECT 
            maint_type_id,
            org_id,
            text,
            int_status
        FROM "tblMaintTypes"
        WHERE maint_type_id = $1
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [maint_type_id]);
};





module.exports = {
    getAllMaintTypes,
    getMaintTypeById,
    
}; 