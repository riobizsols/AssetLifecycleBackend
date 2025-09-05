const db = require('../config/db');

// Insert asset group document
const insertAssetGroupDoc = async ({
  agd_id,
  asset_group_id,
  dto_id,
  doc_type_name,
  doc_path,
  is_archived = false,
  archived_path = null,
  org_id
}) => {
  const query = `
    INSERT INTO "tblAssetGroupDocs" (
      agd_id, asset_group_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [agd_id, asset_group_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id];
  return db.query(query, values);
};

// List asset group documents by group ID
const listAssetGroupDocs = async (asset_group_id) => {
  const query = `
    SELECT agd_id, asset_group_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblAssetGroupDocs"
    WHERE asset_group_id = $1 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY agd_id DESC
  `;
  return db.query(query, [asset_group_id]);
};

// Get asset group document by ID
const getAssetGroupDocById = async (agd_id) => {
  const query = `
    SELECT * FROM "tblAssetGroupDocs" WHERE agd_id = $1
  `;
  return db.query(query, [agd_id]);
};

// List asset group documents by group ID and dto_id
const listAssetGroupDocsByDto = async (asset_group_id, dto_id) => {
  const query = `
    SELECT agd_id, asset_group_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblAssetGroupDocs"
    WHERE asset_group_id = $1 AND dto_id = $2 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY agd_id DESC
  `;
  return db.query(query, [asset_group_id, dto_id]);
};

// Check if asset group exists
const checkAssetGroupExists = async (asset_group_id) => {
  const query = `
    SELECT assetgroup_h_id FROM "tblAssetGroup_H" WHERE assetgroup_h_id = $1
  `;
  return db.query(query, [asset_group_id]);
};

// Update asset group document archive status
const updateAssetGroupDocArchiveStatus = async (agd_id, is_archived, archived_path) => {
  const query = `
    UPDATE "tblAssetGroupDocs" 
    SET is_archived = $2, archived_path = $3
    WHERE agd_id = $1
    RETURNING *
  `;
  const values = [agd_id, is_archived, archived_path];
  return db.query(query, values);
};

// Archive asset group document (legacy function)
const archiveAssetGroupDoc = async (agd_id, archived_path) => {
  const query = `
    UPDATE "tblAssetGroupDocs"
    SET is_archived = true, archived_path = $2
    WHERE agd_id = $1
    RETURNING *
  `;
  return db.query(query, [agd_id, archived_path]);
};

// Delete asset group document
const deleteAssetGroupDoc = async (agd_id) => {
  const query = `
    DELETE FROM "tblAssetGroupDocs" WHERE agd_id = $1
    RETURNING *
  `;
  return db.query(query, [agd_id]);
};

module.exports = { 
  insertAssetGroupDoc, 
  listAssetGroupDocs, 
  getAssetGroupDocById, 
  listAssetGroupDocsByDto,
  checkAssetGroupExists,
  updateAssetGroupDocArchiveStatus,
  archiveAssetGroupDoc,
  deleteAssetGroupDoc
};
