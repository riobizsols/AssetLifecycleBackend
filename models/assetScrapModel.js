const db = require('../config/db');

// Get all scrap assets
const getAllScrapAssets = async () => {
  const query = `
    SELECT 
      asd.asd_id,
      asd.asset_id,
      asd.scrapped_date,
      asd.scrapped_by,
      asd.location,
      asd.notes,
      asd.org_id,
      a.text as asset_name,
      a.serial_number,
      a.description as asset_description,
      at.text as asset_type_name
    FROM "tblAssetScrapDet" asd
    LEFT JOIN "tblAssets" a ON asd.asset_id = a.asset_id
    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    ORDER BY asd.scrapped_date DESC
  `;
  
  return await db.query(query);
};

// Get scrap asset by ID
const getScrapAssetById = async (asd_id) => {
  const query = `
    SELECT 
      asd.asd_id,
      asd.asset_id,
      asd.scrapped_date,
      asd.scrapped_by,
      asd.location,
      asd.notes,
      asd.org_id,
      a.text as asset_name,
      a.serial_number,
      a.description as asset_description,
      at.text as asset_type_name
    FROM "tblAssetScrapDet" asd
    LEFT JOIN "tblAssets" a ON asd.asset_id = a.asset_id
    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    WHERE asd.asd_id = $1
  `;
  
  return await db.query(query, [asd_id]);
};



// Generate ASD ID
const generateAsdId = async () => {
  const query = `
    SELECT COALESCE(MAX(CAST(SUBSTRING(asd_id FROM 4) AS INTEGER)), 0) + 1 as next_seq
    FROM "tblAssetScrapDet"
    WHERE asd_id LIKE 'ASD%'
  `;
  
  const result = await db.query(query);
  const nextSeq = result.rows[0].next_seq;
  return `ASD${nextSeq.toString().padStart(4, '0')}`;
};

// Add new scrap asset
const addScrapAsset = async (scrapData) => {
  const {
    asset_id,
    scrapped_date,
    scrapped_by,
    location,
    notes,
    org_id
  } = scrapData;

  // Generate ASD ID
  const asd_id = await generateAsdId();

  const query = `
    INSERT INTO "tblAssetScrapDet" (
      asd_id,
      asset_id,
      scrapped_date,
      scrapped_by,
      location,
      notes,
      org_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [
    asd_id,
    asset_id,
    scrapped_date,
    scrapped_by,
    location,
    notes,
    org_id
  ];

  return await db.query(query, values);
};

// Update scrap asset
const updateScrapAsset = async (asd_id, updateData) => {
  const {
    asset_id,
    scrapped_date,
    scrapped_by,
    location,
    notes,
    org_id
  } = updateData;

  const query = `
    UPDATE "tblAssetScrapDet"
    SET 
      asset_id = $1,
      scrapped_date = $2,
      scrapped_by = $3,
      location = $4,
      notes = $5,
      org_id = $6
    WHERE asd_id = $7
    RETURNING *
  `;

  const values = [
    asset_id,
    scrapped_date,
    scrapped_by,
    location,
    notes,
    org_id,
    asd_id
  ];

  return await db.query(query, values);
};

// Delete scrap asset
const deleteScrapAsset = async (asd_id) => {
  const query = `
    DELETE FROM "tblAssetScrapDet"
    WHERE asd_id = $1
    RETURNING *
  `;

  return await db.query(query, [asd_id]);
};

// Check if scrap asset exists
const checkScrapAssetExists = async (asd_id) => {
  const query = `
    SELECT asd_id FROM "tblAssetScrapDet"
    WHERE asd_id = $1
  `;
  
  return await db.query(query, [asd_id]);
};

module.exports = {
  getAllScrapAssets,
  getScrapAssetById,
 
  addScrapAsset,
  updateScrapAsset,
  deleteScrapAsset,
  checkScrapAssetExists,
  generateAsdId
};
