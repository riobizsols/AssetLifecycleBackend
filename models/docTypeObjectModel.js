const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

/**
 * Document types are tenant-global reference data (PK is dto_id only).
 * Prefer the caller's org when present, but always fall back to any rows
 * for the requested object_type so Attachments dropdowns stay populated
 * even when only one org was seeded in a multi-org tenant DB.
 */
const getAllDocTypeObjects = async (org_id = null) => {
    const dbPool = getDb();

    if (org_id) {
        const scoped = await dbPool.query(
            `
              SELECT dto_id, object_type, doc_type, doc_type_text, org_id
              FROM "tblDocTypeObjects"
              WHERE org_id = $1
              ORDER BY dto_id
            `,
            [org_id]
        );
        if (scoped.rows.length) return scoped;
    }

    return dbPool.query(
        `
          SELECT dto_id, object_type, doc_type, doc_type_text, org_id
          FROM "tblDocTypeObjects"
          ORDER BY dto_id
        `
    );
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
    
    const dbPool = getDb();
    return await dbPool.query(query, [dto_id]);
};

const getDocTypeObjectsByObjectType = async (object_type, org_id = null) => {
    const dbPool = getDb();
    const baseSelect = `
        SELECT 
            dto_id,
            object_type,
            doc_type,
            doc_type_text,
            org_id
        FROM "tblDocTypeObjects"
        WHERE (LOWER(BTRIM(object_type)) = LOWER(BTRIM($1)) OR object_type = '*')
    `;
    const orderBy = `
        ORDER BY 
            CASE WHEN object_type = '*' THEN 1 ELSE 0 END,
            dto_id
    `;

    if (org_id) {
        const scoped = await dbPool.query(
            `${baseSelect} AND org_id = $2 ${orderBy}`,
            [object_type, org_id]
        );
        if (scoped.rows.length) return scoped;
    }

    return dbPool.query(`${baseSelect} ${orderBy}`, [object_type]);
};

const getDocTypeObjectsByDocType = async (doc_type, org_id = null) => {
    const dbPool = getDb();
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
    const values = [doc_type];

    if (org_id) {
        query += ` AND org_id = $2`;
        values.push(org_id);
    }

    query += ` ORDER BY dto_id`;
    const result = await dbPool.query(query, values);
    if (result.rows.length || !org_id) return result;

    return dbPool.query(
        `
          SELECT dto_id, object_type, doc_type, doc_type_text, org_id
          FROM "tblDocTypeObjects"
          WHERE doc_type = $1
          ORDER BY dto_id
        `,
        [doc_type]
    );
};

const getCommonDocTypeObjects = async (org_id = null) => {
    const dbPool = getDb();
    if (org_id) {
        const scoped = await dbPool.query(
            `
              SELECT dto_id, object_type, doc_type, doc_type_text, org_id
              FROM "tblDocTypeObjects"
              WHERE object_type = '*' AND org_id = $1
              ORDER BY dto_id
            `,
            [org_id]
        );
        if (scoped.rows.length) return scoped;
    }

    return dbPool.query(
        `
          SELECT dto_id, object_type, doc_type, doc_type_text, org_id
          FROM "tblDocTypeObjects"
          WHERE object_type = '*'
          ORDER BY dto_id
        `
    );
};

module.exports = {
    getAllDocTypeObjects,
    getDocTypeObjectById,
    getDocTypeObjectsByObjectType,
    getDocTypeObjectsByDocType,
    getCommonDocTypeObjects
};
