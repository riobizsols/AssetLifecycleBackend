const db = require('../config/db');

const insertAssetDoc = async ({
  a_d_id,
  asset_id,
  dto_id,
  doc_type_name,
  doc_path,
  is_archived = false,
  archived_path = null,
  org_id
}) => {
  const query = `
    INSERT INTO "tblAssetDocs" (
      a_d_id, asset_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `;
  const values = [a_d_id, asset_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id];
  return db.query(query, values);
};

const listAssetDocs = async (asset_id) => {
  const query = `
    SELECT 
      ad.a_d_id, 
      ad.asset_id, 
      ad.dto_id, 
      ad.doc_type_name, 
      ad.doc_path, 
      ad.is_archived, 
      ad.archived_path, 
      ad.org_id,
      dto.doc_type,
      dto.doc_type_text,
      CASE 
        WHEN ad.doc_path IS NOT NULL THEN 
          SPLIT_PART(ad.doc_path, '/', ARRAY_LENGTH(STRING_TO_ARRAY(ad.doc_path, '/'), 1))
        ELSE NULL
      END as file_name
    FROM "tblAssetDocs" ad
    LEFT JOIN "tblDocTypeObjects" dto ON ad.dto_id = dto.dto_id
    WHERE ad.asset_id = $1
    ORDER BY ad.a_d_id DESC
  `;
  return db.query(query, [asset_id]);
};

const getAssetDocById = async (a_d_id) => {
  const query = `
    SELECT * FROM "tblAssetDocs" WHERE a_d_id = $1
  `;
  return db.query(query, [a_d_id]);
};

const updateAssetDocArchiveStatus = async (a_d_id, is_archived, archived_path) => {
  const query = `
    UPDATE "tblAssetDocs" 
    SET is_archived = $2, archived_path = $3
    WHERE a_d_id = $1
    RETURNING *
  `;
  const values = [a_d_id, is_archived, archived_path];
  return db.query(query, values);
};

module.exports = { insertAssetDoc, listAssetDocs, getAssetDocById, updateAssetDocArchiveStatus };


