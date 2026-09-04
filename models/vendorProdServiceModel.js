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
            vps.ven_prod_serv_id,
            vps.prod_serv_id,
            vps.vendor_id,
            vps.org_id,
            ps.asset_type_id,
            ps.brand,
            ps.model,
            ps.description,
            ps.ps_type,
            at.text AS asset_type_text
        FROM "tblVendorProdService" vps
        LEFT JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id
        LEFT JOIN "tblAssetTypes" at
          ON ps.asset_type_id = at.asset_type_id
         AND at.org_id = COALESCE(ps.org_id, vps.org_id)
        WHERE vps.vendor_id = $1
        ORDER BY vps.ven_prod_serv_id
    `;
    
    const dbPool = getDb();

    
    return await dbPool.query(query, [vendor_id]);
};

const getVendorProdServicesByProdServ = async (prod_serv_id) => {
    const query = `
        SELECT 
            vps.ven_prod_serv_id,
            vps.prod_serv_id,
            vps.vendor_id,
            vps.org_id,
            v.vendor_name,
            v.company_name
        FROM "tblVendorProdService" vps
        LEFT JOIN "tblVendors" v ON vps.vendor_id = v.vendor_id
        WHERE vps.prod_serv_id = $1
        ORDER BY vps.ven_prod_serv_id
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
