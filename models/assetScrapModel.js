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

  // Start a transaction to ensure both operations succeed or fail together
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Insert into scrap table
    const insertQuery = `
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

    const insertValues = [
      asd_id,
      asset_id,
      scrapped_date,
      scrapped_by,
      location,
      notes,
      org_id
    ];

    const scrapResult = await client.query(insertQuery, insertValues);
    
    // 2. Update the main asset status to SCRAPPED
    const updateQuery = `
      UPDATE "tblAssets" 
      SET current_status = 'SCRAPPED', 
          changed_by = $1, 
          changed_on = CURRENT_TIMESTAMP
      WHERE asset_id = $2
      RETURNING *
    `;
    
    await client.query(updateQuery, [scrapped_by, asset_id]);
    
    // Commit the transaction
    await client.query('COMMIT');
    
    return scrapResult;
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
