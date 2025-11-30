const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


const getAllMaintTypes = async () => {
    const query = `
        SELECT 
            maint_type_id,
            org_id,
            text,
            int_status
        FROM "tblMaintTypes"
        ORDER BY maint_type_id DESC
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query);
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