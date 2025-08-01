const pool = require('../config/db');

const getChecklistByAssetType = async (assetTypeId, orgId = 'ORG001') => {
  try {
    const query = `
      SELECT 
        at_main_checklist_id,
        org_id,
        asset_type_id,
        text,
        at_main_freq_id
      FROM "tblATMaintCheckList"
      WHERE asset_type_id = $1 
        AND org_id = $2
      ORDER BY at_main_checklist_id ASC
    `;

    const result = await pool.query(query, [assetTypeId, orgId]);
    return result.rows || [];
  } catch (error) {
    console.error('Error in getChecklistByAssetType:', error);
    throw error;
  }
};

const getChecklistByAssetId = async (assetId, orgId = 'ORG001') => {
  try {
    const query = `
      SELECT 
        cl.at_main_checklist_id,
        cl.org_id,
        cl.asset_type_id,
        cl.text,
        cl.at_main_freq_id
      FROM "tblATMaintCheckList" cl
      INNER JOIN "tblAssets" a ON cl.asset_type_id = a.asset_type_id
      INNER JOIN "tblWFAssetMaintSch_H" wfh ON cl.at_main_freq_id = wfh.at_main_freq_id
      WHERE a.asset_id = $1 
        AND cl.org_id = $2
        AND wfh.asset_id = $1
        AND wfh.org_id = $2
      ORDER BY cl.at_main_checklist_id ASC
    `;

    const result = await pool.query(query, [assetId, orgId]);
    return result.rows || [];
  } catch (error) {
    console.error('Error in getChecklistByAssetId:', error);
    throw error;
  }
};

module.exports = {
  getChecklistByAssetType,
  getChecklistByAssetId
}; 