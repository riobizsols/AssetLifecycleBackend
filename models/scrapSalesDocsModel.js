const db = require('../config/db');

// Insert scrap sales document
const insertScrapSalesDoc = async ({
  ssdoc_id,
  ssh_id,
  doc_type,
  doc_type_name,
  doc_path,
  is_archived = false,
  archived_path = null,
  org_id
}) => {
  const query = `
    INSERT INTO "tblScrapSalesDocs" (
      ssdoc_id, ssh_id, doc_type, doc_type_name, doc_path, is_archived, archived_path, org_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [ssdoc_id, ssh_id, doc_type, doc_type_name, doc_path, is_archived, archived_path, org_id];
  return db.query(query, values);
};

// List scrap sales documents by scrap sale ID
const listScrapSalesDocs = async (ssh_id) => {
  const query = `
    SELECT ssdoc_id, ssh_id, doc_type, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblScrapSalesDocs"
    WHERE ssh_id = $1 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY ssdoc_id DESC
  `;
  return db.query(query, [ssh_id]);
};

// Get scrap sales document by ID
const getScrapSalesDocById = async (ssdoc_id) => {
  const query = `
    SELECT * FROM "tblScrapSalesDocs" WHERE ssdoc_id = $1
  `;
  return db.query(query, [ssdoc_id]);
};

// List scrap sales documents by scrap sale ID and document type
const listScrapSalesDocsByType = async (ssh_id, doc_type) => {
  const query = `
    SELECT ssdoc_id, ssh_id, doc_type, doc_type_name, doc_path, is_archived, archived_path, org_id
    FROM "tblScrapSalesDocs"
    WHERE ssh_id = $1 AND doc_type = $2 AND (is_archived = false OR is_archived IS NULL)
    ORDER BY ssdoc_id DESC
  `;
  return db.query(query, [ssh_id, doc_type]);
};

// Check if scrap sale exists
const checkScrapSaleExists = async (ssh_id) => {
  const query = `
    SELECT ssh_id FROM "tblScrapSales_H" WHERE ssh_id = $1
  `;
  return db.query(query, [ssh_id]);
};

// Archive scrap sales document
const archiveScrapSalesDoc = async (ssdoc_id, archived_path) => {
  const query = `
    UPDATE "tblScrapSalesDocs"
    SET is_archived = true, archived_path = $2
    WHERE ssdoc_id = $1
    RETURNING *
  `;
  return db.query(query, [ssdoc_id, archived_path]);
};

// Delete scrap sales document
const deleteScrapSalesDoc = async (ssdoc_id) => {
  const query = `
    DELETE FROM "tblScrapSalesDocs" WHERE ssdoc_id = $1
    RETURNING *
  `;
  return db.query(query, [ssdoc_id]);
};

module.exports = { 
  insertScrapSalesDoc, 
  listScrapSalesDocs, 
  getScrapSalesDocById, 
  listScrapSalesDocsByType,
  checkScrapSaleExists,
  archiveScrapSalesDoc,
  deleteScrapSalesDoc
};
