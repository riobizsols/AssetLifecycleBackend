const db = require('../config/db');

const getAllVendorProdServices = async () => {
    const query = `
        SELECT 
            ven_prod_serv_id, ext_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        ORDER BY ven_prod_serv_id
    `;
    
    return await db.query(query);
};

const getVendorProdServiceById = async (ven_prod_serv_id) => {
    const query = `
        SELECT 
            ven_prod_serv_id, ext_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        WHERE ven_prod_serv_id = $1
    `;
    
    return await db.query(query, [ven_prod_serv_id]);
};

const getVendorProdServicesByVendor = async (vendor_id) => {
    const query = `
        SELECT 
            ven_prod_serv_id, ext_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        WHERE vendor_id = $1
        ORDER BY ven_prod_serv_id
    `;
    
    return await db.query(query, [vendor_id]);
};

const getVendorProdServicesByProdServ = async (prod_serv_id) => {
    const query = `
        SELECT 
            ven_prod_serv_id, ext_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        WHERE prod_serv_id = $1
        ORDER BY ven_prod_serv_id
    `;
    
    return await db.query(query, [prod_serv_id]);
};

const getVendorProdServicesByOrg = async (org_id) => {
    const query = `
        SELECT 
            ven_prod_serv_id, ext_id, prod_serv_id, vendor_id, org_id
        FROM "tblVendorProdService"
        WHERE org_id = $1
        ORDER BY ven_prod_serv_id
    `;
    
    return await db.query(query, [org_id]);
};

const insertVendorProdService = async (ven_prod_serv_id, ext_id, prod_serv_id, vendor_id, org_id) => {
    const query = `
        INSERT INTO "tblVendorProdService" (
            ven_prod_serv_id, ext_id, prod_serv_id, vendor_id, org_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    
    const values = [ven_prod_serv_id, ext_id, prod_serv_id, vendor_id, org_id];
    
    return await db.query(query, values);
};

const updateVendorProdService = async (ven_prod_serv_id, updateData) => {
    const {
        ext_id, prod_serv_id, vendor_id, org_id
    } = updateData;
    
    const query = `
        UPDATE "tblVendorProdService"
        SET 
            ext_id = $1, prod_serv_id = $2, vendor_id = $3, org_id = $4
        WHERE ven_prod_serv_id = $5
        RETURNING *
    `;
    
    const values = [ext_id, prod_serv_id, vendor_id, org_id, ven_prod_serv_id];
    
    return await db.query(query, values);
};

const deleteVendorProdService = async (ven_prod_serv_id) => {
    const query = `
        DELETE FROM "tblVendorProdService"
        WHERE ven_prod_serv_id = $1
        RETURNING *
    `;
    
    return await db.query(query, [ven_prod_serv_id]);
};

const deleteMultipleVendorProdServices = async (ven_prod_serv_ids) => {
    const query = `
        DELETE FROM "tblVendorProdService"
        WHERE ven_prod_serv_id = ANY($1::text[])
        RETURNING *
    `;
    
    return await db.query(query, [ven_prod_serv_ids]);
};

const checkVendorProdServiceExists = async (ext_id, org_id) => {
    const query = `
        SELECT ven_prod_serv_id FROM "tblVendorProdService"
        WHERE ext_id = $1 AND org_id = $2
    `;
    
    return await db.query(query, [ext_id, org_id]);
};

const checkVendorProdServiceIdExists = async (ven_prod_serv_id) => {
    const query = `
        SELECT ven_prod_serv_id FROM "tblVendorProdService"
        WHERE ven_prod_serv_id = $1
    `;
    
    return await db.query(query, [ven_prod_serv_id]);
};

const getVendorProdServiceWithDetails = async (ven_prod_serv_id) => {
    const query = `
        SELECT 
            vps.ven_prod_serv_id, vps.ext_id, vps.prod_serv_id, vps.vendor_id, vps.org_id,
            v.text as vendor_name,
            ps.text as prod_serv_name
        FROM "tblVendorProdService" vps
        LEFT JOIN "tblVendors" v ON vps.vendor_id = v.vendor_id
        LEFT JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id
        WHERE vps.ven_prod_serv_id = $1
    `;
    
    return await db.query(query, [ven_prod_serv_id]);
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
