const db = require('../config/db');

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
    
    return await db.query(query);
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
    
    return await db.query(query, [maint_type_id]);
};





module.exports = {
    getAllMaintTypes,
    getMaintTypeById,
    
}; 