const db = require('../config/db');

// Insert asset type document
const insertAssetTypeDoc = async ({
  atd_id,
  asset_type_id,
  dto_id,
  doc_type_name,
  doc_path,
  is_archived = false,
  archived_path = null,
  org_id
}) => {
  const query = `
    INSERT INTO "tblATDocs" (
      atd_id, asset_type_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [atd_id, asset_type_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id];
  return db.query(query, values);
};

// List asset type documents by asset type ID
const listAssetTypeDocs = async (asset_type_id) => {
  const query = `
    SELECT atd_id, asset_type_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblATDocs"
    WHERE asset_type_id = $1 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY atd_id DESC
  `;
  return db.query(query, [asset_type_id]);
};

// Get asset type document by ID
const getAssetTypeDocById = async (atd_id) => {
  const query = `
    SELECT * FROM "tblATDocs" WHERE atd_id = $1
  `;
  return db.query(query, [atd_id]);
};

// List asset type documents by asset type ID and dto_id
const listAssetTypeDocsByDto = async (asset_type_id, dto_id) => {
  const query = `
    SELECT atd_id, asset_type_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblATDocs"
    WHERE asset_type_id = $1 AND dto_id = $2 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY atd_id DESC
  `;
  return db.query(query, [asset_type_id, dto_id]);
};

// Check if asset type exists
const checkAssetTypeExists = async (asset_type_id) => {
  const query = `
    SELECT asset_type_id FROM "tblAssetTypes" WHERE asset_type_id = $1
  `;
  return db.query(query, [asset_type_id]);
};

// Update asset type document archive status
const updateAssetTypeDocArchiveStatus = async (atd_id, is_archived, archived_path) => {
  const query = `
    UPDATE "tblATDocs" 
    SET is_archived = $2, archived_path = $3
    WHERE atd_id = $1
    RETURNING *
  `;
  const values = [atd_id, is_archived, archived_path];
  return db.query(query, values);
};

// Archive asset type document
const archiveAssetTypeDoc = async (atd_id, archived_path) => {
  const query = `
    UPDATE "tblATDocs"
    SET is_archived = true, archived_path = $2
    WHERE atd_id = $1
    RETURNING *
  `;
  return db.query(query, [atd_id, archived_path]);
};

// Delete asset type document
const deleteAssetTypeDoc = async (atd_id) => {
  const query = `
    DELETE FROM "tblATDocs" WHERE atd_id = $1
    RETURNING *
  `;
  return db.query(query, [atd_id]);
};

module.exports = { 
  insertAssetTypeDoc, 
  listAssetTypeDocs, 
  getAssetTypeDocById, 
  listAssetTypeDocsByDto,
  checkAssetTypeExists,
  updateAssetTypeDocArchiveStatus,
  archiveAssetTypeDoc,
  deleteAssetTypeDoc
};
