const db = require('../config/db');

// Get scrap assets by asset type, excluding those already in scrap sales
const getScrapAssetsByAssetType = async (asset_type_id) => {
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
      at.text as asset_type_name,
      at.asset_type_id
    FROM "tblAssetScrapDet" asd
    LEFT JOIN "tblAssets" a ON asd.asset_id = a.asset_id
    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    WHERE at.asset_type_id = $1
    AND asd.asd_id NOT IN (
      SELECT DISTINCT asd_id 
      FROM "tblScrapSales_D" 
      WHERE asd_id IS NOT NULL
    )
    ORDER BY asd.scrapped_date DESC
  `;
  
  return await db.query(query, [asset_type_id]);
};

// Get all asset types that have scrap assets (excluding those in scrap sales)
const getAssetTypesWithScrapAssets = async () => {
  const query = `
    SELECT DISTINCT 
      at.asset_type_id,
      at.text as asset_type_name,
      COUNT(asd.asd_id) as scrap_count
    FROM "tblAssetTypes" at
    INNER JOIN "tblAssets" a ON at.asset_type_id = a.asset_type_id
    INNER JOIN "tblAssetScrapDet" asd ON a.asset_id = asd.asset_id
    WHERE asd.asd_id NOT IN (
      SELECT DISTINCT asd_id 
      FROM "tblScrapSales_D" 
      WHERE asd_id IS NOT NULL
    )
    GROUP BY at.asset_type_id, at.text
    HAVING COUNT(asd.asd_id) > 0
    ORDER BY at.text
  `;
  
  return await db.query(query);
};

module.exports = {
  getScrapAssetsByAssetType,
  getAssetTypesWithScrapAssets
};
