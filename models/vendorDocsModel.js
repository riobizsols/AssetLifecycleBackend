const db = require('../config/db');

// Insert vendor document
const insertVendorDoc = async ({
  vd_id,
  vendor_id,
  dto_id,
  doc_type_name,
  doc_path,
  is_archived = false,
  archived_path = null,
  org_id
}) => {
  const query = `
    INSERT INTO "tblVendorDocs" (
      vd_id, vendor_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [vd_id, vendor_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id];
  return db.query(query, values);
};

// List vendor documents by vendor ID
const listVendorDocs = async (vendor_id) => {
  const query = `
    SELECT vd_id, vendor_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblVendorDocs"
    WHERE vendor_id = $1 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY vd_id DESC
  `;
  return db.query(query, [vendor_id]);
};

// Get vendor document by ID
const getVendorDocById = async (vd_id) => {
  const query = `
    SELECT * FROM "tblVendorDocs" WHERE vd_id = $1
  `;
  return db.query(query, [vd_id]);
};

// List vendor documents by vendor ID and dto_id
const listVendorDocsByDto = async (vendor_id, dto_id) => {
  const query = `
    SELECT vd_id, vendor_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblVendorDocs"
    WHERE vendor_id = $1 AND dto_id = $2 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY vd_id DESC
  `;
  return db.query(query, [vendor_id, dto_id]);
};

// Check if vendor exists
const checkVendorExists = async (vendor_id) => {
  const query = `
    SELECT vendor_id FROM "tblVendors" WHERE vendor_id = $1
  `;
  return db.query(query, [vendor_id]);
};

// Update vendor document archive status
const updateVendorDocArchiveStatus = async (vd_id, is_archived, archived_path) => {
  const query = `
    UPDATE "tblVendorDocs" 
    SET is_archived = $2, archived_path = $3
    WHERE vd_id = $1
    RETURNING *
  `;
  const values = [vd_id, is_archived, archived_path];
  return db.query(query, values);
};

// Archive vendor document (legacy function)
const archiveVendorDoc = async (vd_id, archived_path) => {
  const query = `
    UPDATE "tblVendorDocs"
    SET is_archived = true, archived_path = $2
    WHERE vd_id = $1
    RETURNING *
  `;
  return db.query(query, [vd_id, archived_path]);
};

// Delete vendor document
const deleteVendorDoc = async (vd_id) => {
  const query = `
    DELETE FROM "tblVendorDocs" WHERE vd_id = $1
    RETURNING *
  `;
  return db.query(query, [vd_id]);
};

module.exports = { 
  insertVendorDoc, 
  listVendorDocs, 
  getVendorDocById, 
  listVendorDocsByDto,
  checkVendorExists,
  updateVendorDocArchiveStatus,
  archiveVendorDoc,
  deleteVendorDoc
};
