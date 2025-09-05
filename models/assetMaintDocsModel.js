const db = require('../config/db');

// Insert asset maintenance document
const insertAssetMaintDoc = async ({
  amd_id,
  asset_id,
  dto_id,
  doc_type_name,
  doc_path,
  is_archived = false,
  archived_path = null,
  org_id
}) => {
  const query = `
    INSERT INTO "tblAssetMaintDocs" (
      amd_id, asset_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [amd_id, asset_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id];
  return db.query(query, values);
};

// List asset maintenance documents by asset ID
const listAssetMaintDocs = async (asset_id) => {
  const query = `
    SELECT amd_id, asset_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblAssetMaintDocs"
    WHERE asset_id = $1 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY amd_id DESC
  `;
  return db.query(query, [asset_id]);
};

// List asset maintenance documents by work order ID (ams_id)
const listAssetMaintDocsByWorkOrder = async (ams_id) => {
  const query = `
    SELECT amd.amd_id, amd.asset_id, amd.dto_id, amd.doc_type_name, amd.doc_path, amd.is_archived, amd.archived_path, amd.org_id
    FROM "tblAssetMaintDocs" amd
    INNER JOIN "tblAssetMaintSch" ams ON amd.asset_id = ams.asset_id
    WHERE ams.ams_id = $1 AND (amd.is_archived = false OR amd.is_archived IS NULL)
    ORDER BY amd.amd_id DESC
  `;
  return db.query(query, [ams_id]);
};

// Get asset maintenance document by ID
const getAssetMaintDocById = async (amd_id) => {
  const query = `
    SELECT * FROM "tblAssetMaintDocs" WHERE amd_id = $1
  `;
  return db.query(query, [amd_id]);
};

// List asset maintenance documents by asset ID and dto_id
const listAssetMaintDocsByDto = async (asset_id, dto_id) => {
  const query = `
    SELECT amd_id, asset_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblAssetMaintDocs"
    WHERE asset_id = $1 AND dto_id = $2 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY amd_id DESC
  `;
  return db.query(query, [asset_id, dto_id]);
};

// List asset maintenance documents by work order ID and dto_id
const listAssetMaintDocsByWorkOrderAndDto = async (ams_id, dto_id) => {
  const query = `
    SELECT amd.amd_id, amd.asset_id, amd.dto_id, amd.doc_type_name, amd.doc_path, amd.is_archived, amd.archived_path, amd.org_id
    FROM "tblAssetMaintDocs" amd
    INNER JOIN "tblAssetMaintSch" ams ON amd.asset_id = ams.asset_id
    WHERE ams.ams_id = $1 AND amd.dto_id = $2 AND (amd.is_archived = false OR amd.is_archived IS NULL)
    ORDER BY amd.amd_id DESC
  `;
  return db.query(query, [ams_id, dto_id]);
};

// Check if asset exists
const checkAssetExists = async (asset_id) => {
  const query = `
    SELECT asset_id FROM "tblAssets" WHERE asset_id = $1
  `;
  return db.query(query, [asset_id]);
};

// Check if work order exists
const checkWorkOrderExists = async (ams_id) => {
  const query = `
    SELECT ams_id FROM "tblAssetMaintSch" WHERE ams_id = $1
  `;
  return db.query(query, [ams_id]);
};

// Update asset maintenance document archive status
const updateAssetMaintDocArchiveStatus = async (amd_id, is_archived, archived_path) => {
  const query = `
    UPDATE "tblAssetMaintDocs" 
    SET is_archived = $2, archived_path = $3
    WHERE amd_id = $1
    RETURNING *
  `;
  const values = [amd_id, is_archived, archived_path];
  return db.query(query, values);
};

// Archive asset maintenance document (legacy function)
const archiveAssetMaintDoc = async (amd_id, archived_path) => {
  const query = `
    UPDATE "tblAssetMaintDocs"
    SET is_archived = true, archived_path = $2
    WHERE amd_id = $1
    RETURNING *
  `;
  return db.query(query, [amd_id, archived_path]);
};

// Delete asset maintenance document
const deleteAssetMaintDoc = async (amd_id) => {
  const query = `
    DELETE FROM "tblAssetMaintDocs" WHERE amd_id = $1
    RETURNING *
  `;
  return db.query(query, [amd_id]);
};

module.exports = { 
  insertAssetMaintDoc, 
  listAssetMaintDocs, 
  listAssetMaintDocsByWorkOrder,
  getAssetMaintDocById, 
  listAssetMaintDocsByDto,
  listAssetMaintDocsByWorkOrderAndDto,
  checkAssetExists,
  checkWorkOrderExists,
  updateAssetMaintDocArchiveStatus,
  archiveAssetMaintDoc,
  deleteAssetMaintDoc
};
