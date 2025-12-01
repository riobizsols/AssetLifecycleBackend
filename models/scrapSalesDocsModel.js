const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


// Insert scrap sales document
const insertScrapSalesDoc = async ({
  ssdoc_id,
  ssh_id,
  dto_id,
  doc_type_name,
  doc_path,
  is_archived = false,
  archived_path = null,
  org_id
}) => {
  const query = `
    INSERT INTO "tblScrapSalesDocs" (
      ssdoc_id, ssh_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;
  const values = [ssdoc_id, ssh_id, dto_id, doc_type_name, doc_path, is_archived, archived_path, org_id];
  const dbPool = getDb();

  return dbPool.query(query, values);
};

// List scrap sales documents by scrap sale ID
const listScrapSalesDocs = async (ssh_id) => {
  const query = `
    SELECT 
      ssd.ssdoc_id, 
      ssd.ssh_id, 
      ssd.dto_id,
      ssd.doc_type_name, 
      ssd.doc_path, 
      ssd.is_archived, 
      ssd.archived_path, 
      ssd.org_id,
      dto.doc_type_text,
      dto.doc_type,
      CASE 
        WHEN ssd.doc_path IS NOT NULL THEN 
          SUBSTRING(ssd.doc_path FROM '.*/([^/]+)$')
        ELSE 'document'
      END as file_name
    FROM "tblScrapSalesDocs" ssd
    LEFT JOIN "tblDocTypeObjects" dto ON ssd.dto_id = dto.dto_id
    WHERE ssd.ssh_id = $1
    ORDER BY ssd.ssdoc_id DESC
  `;
  const dbPool = getDb();

  return dbPool.query(query, [ssh_id]);
};

// Get scrap sales document by ID
const getScrapSalesDocById = async (ssdoc_id) => {
  const query = `
    SELECT 
      ssd.ssdoc_id, 
      ssd.ssh_id, 
      ssd.dto_id,
      ssd.doc_type_name, 
      ssd.doc_path, 
      ssd.is_archived, 
      ssd.archived_path, 
      ssd.org_id,
      dto.doc_type_text,
      dto.doc_type,
      CASE 
        WHEN ssd.doc_path IS NOT NULL THEN 
          SUBSTRING(ssd.doc_path FROM '.*/([^/]+)$')
        ELSE 'document'
      END as file_name
    FROM "tblScrapSalesDocs" ssd
    LEFT JOIN "tblDocTypeObjects" dto ON ssd.dto_id = dto.dto_id
    WHERE ssd.ssdoc_id = $1
  `;
  const dbPool = getDb();

  return dbPool.query(query, [ssdoc_id]);
};

// List scrap sales documents by scrap sale ID and document type
const listScrapSalesDocsByType = async (ssh_id, doc_type) => {
  const query = `
    SELECT 
      ssd.ssdoc_id, 
      ssd.ssh_id, 
      ssd.dto_id,
      ssd.doc_type_name, 
      ssd.doc_path, 
      ssd.is_archived, 
      ssd.archived_path, 
      ssd.org_id,
      dto.doc_type_text,
      dto.doc_type,
      CASE 
        WHEN ssd.doc_path IS NOT NULL THEN 
          SUBSTRING(ssd.doc_path FROM '.*/([^/]+)$')
        ELSE 'document'
      END as file_name
    FROM "tblScrapSalesDocs" ssd
    LEFT JOIN "tblDocTypeObjects" dto ON ssd.dto_id = dto.dto_id
    WHERE ssd.ssh_id = $1 AND dto.doc_type = $2
    ORDER BY ssd.ssdoc_id DESC
  `;
  const dbPool = getDb();

  return dbPool.query(query, [ssh_id, doc_type]);
};

// Check if scrap sale exists
const checkScrapSaleExists = async (ssh_id) => {
  const query = `
    SELECT ssh_id FROM "tblScrapSales_H" WHERE ssh_id = $1
  `;
  const dbPool = getDb();

  return dbPool.query(query, [ssh_id]);
};

// Archive scrap sales document
const archiveScrapSalesDoc = async (ssdoc_id, archived_path) => {
  const query = `
    UPDATE "tblScrapSalesDocs"
    SET is_archived = true, archived_path = $2
    WHERE ssdoc_id = $1
    RETURNING *
  `;
  const dbPool = getDb();

  return dbPool.query(query, [ssdoc_id, archived_path]);
};

// Delete scrap sales document
const deleteScrapSalesDoc = async (ssdoc_id) => {
  const query = `
    DELETE FROM "tblScrapSalesDocs" WHERE ssdoc_id = $1
    RETURNING *
  `;
  const dbPool = getDb();

  return dbPool.query(query, [ssdoc_id]);
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
