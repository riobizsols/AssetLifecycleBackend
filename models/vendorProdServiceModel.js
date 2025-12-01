const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


const getAllVendorProdServices = async () => {
    const query = `
        SELECT 
            ven_prod_serv_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        ORDER BY ven_prod_serv_id
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query);
};

const getVendorProdServiceById = async (ven_prod_serv_id) => {
    const query = `
        SELECT 
            ven_prod_serv_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        WHERE ven_prod_serv_id = $1
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [ven_prod_serv_id]);
};

const getVendorProdServicesByVendor = async (vendor_id) => {
    const query = `
        SELECT 
            ven_prod_serv_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        WHERE vendor_id = $1
        ORDER BY ven_prod_serv_id
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [vendor_id]);
};

const getVendorProdServicesByProdServ = async (prod_serv_id) => {
    const query = `
        SELECT 
            ven_prod_serv_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        WHERE prod_serv_id = $1
        ORDER BY ven_prod_serv_id
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [prod_serv_id]);
};

const getVendorProdServicesByOrg = async (org_id) => {
    const query = `
        SELECT 
            ven_prod_serv_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        WHERE org_id = $1
        ORDER BY ven_prod_serv_id
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [org_id]);
};

const insertVendorProdService = async (ven_prod_serv_id, prod_serv_id, vendor_id, org_id) => {
    const query = `
        INSERT INTO "tblVendorProdService" (
            ven_prod_serv_id, prod_serv_id, vendor_id, org_id
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    
    const values = [ven_prod_serv_id, prod_serv_id, vendor_id, org_id];
    
    const dbPool = getDb();

    
    return await dbPool.query(query, values);
};

const updateVendorProdService = async (ven_prod_serv_id, updateData) => {
    const {
        prod_serv_id, vendor_id, org_id
    } = updateData;
    
    const query = `
        UPDATE "tblVendorProdService"
        SET 
            prod_serv_id = $1, vendor_id = $2, org_id = $3
        WHERE ven_prod_serv_id = $4
        RETURNING *
    `;
    
    const values = [prod_serv_id, vendor_id, org_id, ven_prod_serv_id];
    
    const dbPool = getDb();

    
    return await dbPool.query(query, values);
};

const deleteVendorProdService = async (ven_prod_serv_id) => {
    const query = `
        DELETE FROM "tblVendorProdService"
        WHERE ven_prod_serv_id = $1
        RETURNING *
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [ven_prod_serv_id]);
};

const deleteMultipleVendorProdServices = async (ven_prod_serv_ids) => {
    const query = `
        DELETE FROM "tblVendorProdService"
        WHERE ven_prod_serv_id = ANY($1::text[])
        RETURNING *
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [ven_prod_serv_ids]);
};

const checkVendorProdServiceExists = async (vendor_id, prod_serv_id, org_id) => {
    const query = `
        SELECT ven_prod_serv_id FROM "tblVendorProdService"
        WHERE vendor_id = $1 AND prod_serv_id = $2 AND org_id = $3
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [vendor_id, prod_serv_id, org_id]);
};

const checkVendorProdServiceIdExists = async (ven_prod_serv_id) => {
    const query = `
        SELECT ven_prod_serv_id FROM "tblVendorProdService"
        WHERE ven_prod_serv_id = $1
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [ven_prod_serv_id]);
};

const getVendorProdServiceWithDetails = async (ven_prod_serv_id) => {
    const query = `
        SELECT 
            vps.ven_prod_serv_id, vps.prod_serv_id, vps.vendor_id, vps.org_id,
            v.vendor_name,
            ps.description as prod_serv_name
        FROM "tblVendorProdService" vps
        LEFT JOIN "tblVendors" v ON vps.vendor_id = v.vendor_id
        LEFT JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id
        WHERE vps.ven_prod_serv_id = $1
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [ven_prod_serv_id]);
};

module.exports = {
    getAllVendorProdServices,
    getVendorProdServiceById,
    getVendorProdServicesByVendor,
    getVendorProdServicesByProdServ,
    getVendorProdServicesByOrg,
    insertVendorProdService,
    updateVendorProdService,
    deleteVendorProdService,
    deleteMultipleVendorProdServices,
    checkVendorProdServiceExists,
    checkVendorProdServiceIdExists,
    getVendorProdServiceWithDetails
};
