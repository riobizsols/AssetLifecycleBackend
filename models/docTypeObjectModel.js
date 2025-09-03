const db = require('../config/db');

const getAllDocTypeObjects = async (org_id = null) => {
    let query = `
        SELECT 
            dto_id,
            object_type,
            doc_type,
            doc_type_text,
            org_id
        FROM "tblDocTypeObjects"
    `;
    
    let values = [];
    
    if (org_id) {
        query += ` WHERE org_id = $1`;
        values.push(org_id);
    }
    
    query += ` ORDER BY dto_id`;
    
    return await db.query(query, values);
};

const getDocTypeObjectById = async (dto_id) => {
    const query = `
        SELECT 
            dto_id,
            object_type,
            doc_type,
            doc_type_text,
            org_id
        FROM "tblDocTypeObjects"
        WHERE dto_id = $1
    `;
    
    return await db.query(query, [dto_id]);
};

const getDocTypeObjectsByObjectType = async (object_type, org_id = null) => {
    let query = `
        SELECT 
            dto_id,
            object_type,
            doc_type,
            doc_type_text,
            org_id
        FROM "tblDocTypeObjects"
        WHERE (object_type = $1 OR object_type = '*')
    `;
    
    let values = [object_type];
    
    if (org_id) {
        query += ` AND org_id = $2`;
        values.push(org_id);
    }
    
    query += ` ORDER BY 
        CASE 
            WHEN object_type = '*' THEN 1 
            ELSE 0 
        END,
        dto_id`;
    
    return await db.query(query, values);
};

const getDocTypeObjectsByDocType = async (doc_type, org_id = null) => {
    let query = `
        SELECT 
            dto_id,
            object_type,
            doc_type,
            doc_type_text,
            org_id
        FROM "tblDocTypeObjects"
        WHERE doc_type = $1
    `;
    
    let values = [doc_type];
    
    if (org_id) {
        query += ` AND org_id = $2`;
        values.push(org_id);
    }
    
    query += ` ORDER BY dto_id`;
    
    return await db.query(query, values);
};

const getCommonDocTypeObjects = async (org_id = null) => {
    let query = `
        SELECT 
            dto_id,
            object_type,
            doc_type,
            doc_type_text,
            org_id
        FROM "tblDocTypeObjects"
        WHERE object_type = '*'
    `;
    
    let values = [];
    
    if (org_id) {
        query += ` AND org_id = $1`;
        values.push(org_id);
    }
    
    query += ` ORDER BY dto_id`;
    
    return await db.query(query, values);
};

module.exports = {
    getAllDocTypeObjects,
    getDocTypeObjectById,
    getDocTypeObjectsByObjectType,
    getDocTypeObjectsByDocType,
    getCommonDocTypeObjects
};
