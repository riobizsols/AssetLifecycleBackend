const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


// Get all scrap assets - supports super access users who can view all branches
const getAllScrapAssets = async (org_id, branch_id, hasSuperAccess = false) => {
  let query = `
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
    WHERE asd.org_id = $1
  `;
  const params = [org_id];
  
  // Apply branch filter only if user doesn't have super access
  if (!hasSuperAccess && branch_id) {
    query += ` AND a.branch_id = $2`;
    params.push(branch_id);
  }
  
  query += ` ORDER BY asd.scrapped_date DESC`;
  
  const dbPool = getDb();

  
  return await dbPool.query(query, params);
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
  
  const dbPool = getDb();

  
  return await dbPool.query(query, [asd_id]);
};



// Generate ASD ID
const generateAsdId = async () => {
  const query = `
    SELECT COALESCE(MAX(CAST(SUBSTRING(asd_id FROM 4) AS INTEGER)), 0) + 1 as next_seq
    FROM "tblAssetScrapDet"
    WHERE asd_id LIKE 'ASD%'
  `;
  
  const dbPool = getDb();

  
  const result = await dbPool.query(query);
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
  const dbPool = getDb();

  const client = await dbPool.connect();
  
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
    
    // Resolve changed_by to tblUsers.user_id (tblAssets.changed_by has FK to tblUsers)
    let changedByUserId = null;
    if (scrapped_by) {
      const byEmp = await client.query(`SELECT user_id FROM "tblUsers" WHERE emp_int_id = $1`, [scrapped_by]);
      if (byEmp.rows.length) {
        changedByUserId = byEmp.rows[0].user_id;
      } else {
        const byUserId = await client.query(`SELECT user_id FROM "tblUsers" WHERE user_id = $1`, [scrapped_by]);
        if (byUserId.rows.length) changedByUserId = scrapped_by;
      }
    }

    // 2. Update the main asset status to SCRAPPED (+ store scrap metadata in tblAssets)
    const updateQuery = `
      UPDATE "tblAssets" 
      SET current_status = 'SCRAPPED', 
          changed_by = $1, 
          changed_on = CURRENT_TIMESTAMP,
          scrap_notes = $3,
          scraped_by = $4,
          scraped_on = COALESCE($5::timestamp, CURRENT_TIMESTAMP)
      WHERE asset_id = $2
      RETURNING *
    `;
    
    await client.query(updateQuery, [
      changedByUserId,
      asset_id,
      notes || null,
      scrapped_by || null,
      scrapped_date || null,
    ]);
    
    // 3. Unassign asset from department or employee if currently assigned
    // Update all active assignments (action='A' and latest_assignment_flag=true) to unassign them
    const unassignQuery = `
      UPDATE "tblAssetAssignments" 
      SET action = 'C',
          latest_assignment_flag = false,
          action_on = CURRENT_TIMESTAMP,
          action_by = $1
      WHERE asset_id = $2 
        AND action = 'A' 
        AND latest_assignment_flag = true
    `;
    
    // action_by in assignments is not FK-constrained in most schemas, keep original scrapped_by value
    await client.query(unassignQuery, [scrapped_by, asset_id]);
    
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

  const dbPool = getDb();


  return await dbPool.query(query, values);
};

// Delete scrap asset
const deleteScrapAsset = async (asd_id) => {
  const query = `
    DELETE FROM "tblAssetScrapDet"
    WHERE asd_id = $1
    RETURNING *
  `;

  const dbPool = getDb();


  return await dbPool.query(query, [asd_id]);
};

// Check if scrap asset exists
const checkScrapAssetExists = async (asd_id) => {
  const query = `
    SELECT asd_id FROM "tblAssetScrapDet"
    WHERE asd_id = $1
  `;
  
  const dbPool = getDb();

  
  return await dbPool.query(query, [asd_id]);
};

// Get available assets by asset type (exclude those already scrapped and those in any group)
const getAvailableAssetsByAssetType = async (asset_type_id, org_id = null) => {
  let query = `
    SELECT 
      a.asset_id,
      a.text AS asset_name,
      a.serial_number,
      a.asset_type_id,
      at.text AS asset_type_name,
      a.org_id
    FROM "tblAssets" a
    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    WHERE a.asset_type_id = $1
      AND a.group_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "tblAssetGroup_D" agd
        WHERE agd.asset_id = a.asset_id
      )
      AND NOT EXISTS (
        SELECT 1 
        FROM "tblAssetScrapDet" s 
        WHERE s.asset_id = a.asset_id
      )`;

  const params = [asset_type_id];

  if (org_id) {
    query += ` AND a.org_id = $2`;
    params.push(org_id);
  }

  query += ` ORDER BY a.text`;

  const dbPool = getDb();


  return await dbPool.query(query, params);
};

module.exports = {
  getAllScrapAssets,
  getScrapAssetById,
 
  addScrapAsset,
  updateScrapAsset,
  deleteScrapAsset,
  checkScrapAssetExists,
  generateAsdId,
  getAvailableAssetsByAssetType
};
