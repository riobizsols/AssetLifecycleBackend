const db = require('../config/db');

const insertAssetDoc = async ({
  a_d_id,
  asset_id,
  doc_type,
  doc_type_name,
  doc_path,
  is_archived = false,
  archived_path = null,
  org_id
}) => {
  const query = `
    INSERT INTO "tblAssetDocs" (
      a_d_id, asset_id, doc_type, doc_type_name, doc_path, is_archived, archived_path, org_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
  `;
  const values = [a_d_id, asset_id, doc_type, doc_type_name, doc_path, is_archived, archived_path, org_id];
  return db.query(query, values);
};

const listAssetDocs = async (asset_id) => {
  const query = `
    SELECT a_d_id, asset_id, doc_type, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblAssetDocs"
    WHERE asset_id = $1 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY a_d_id DESC
  `;
  return db.query(query, [asset_id]);
};

const getAssetDocById = async (a_d_id) => {
  const query = `
    SELECT * FROM "tblAssetDocs" WHERE a_d_id = $1
  `;
  return db.query(query, [a_d_id]);
};

module.exports = { insertAssetDoc, listAssetDocs, getAssetDocById };


