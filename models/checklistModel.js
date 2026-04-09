const { getDb } = require('../utils/dbContext');

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

    const result = await getDb().query(query, [assetTypeId, orgId]);
    return result.rows || [];
  } catch (error) {
    console.error('Error in getChecklistByAssetType:', error);
    throw error;
  }
};

/**
 * Checklist lines for maintenance approval.
 * @param {string} assetId
 * @param {string} orgId
 * @param {string|null} wfamshId - When set, checklist is scoped to this workflow header (fixes NULL at_main_freq_id and wrong-row joins).
 */
const getChecklistByAssetId = async (assetId, orgId = 'ORG001', wfamshId = null) => {
  try {
    const dbPool = getDb();

    if (wfamshId) {
      const query = `
        SELECT 
          cl.at_main_checklist_id,
          cl.org_id,
          cl.asset_type_id,
          cl.text,
          cl.at_main_freq_id
        FROM "tblATMaintCheckList" cl
        INNER JOIN "tblAssets" a ON cl.asset_type_id = a.asset_type_id
        INNER JOIN "tblWFAssetMaintSch_H" wfh
          ON wfh.wfamsh_id = $3
          AND wfh.org_id = $2
          AND wfh.asset_id = a.asset_id
        WHERE a.asset_id = $1
          AND cl.org_id = $2
          AND cl.at_main_freq_id IS NOT DISTINCT FROM wfh.at_main_freq_id
        ORDER BY cl.at_main_checklist_id ASC
      `;
      const result = await dbPool.query(query, [assetId, orgId, wfamshId]);
      return result.rows || [];
    }

    const query = `
      SELECT 
        cl.at_main_checklist_id,
        cl.org_id,
        cl.asset_type_id,
        cl.text,
        cl.at_main_freq_id
      FROM "tblATMaintCheckList" cl
      INNER JOIN "tblAssets" a ON cl.asset_type_id = a.asset_type_id
      INNER JOIN "tblWFAssetMaintSch_H" wfh
        ON cl.at_main_freq_id IS NOT DISTINCT FROM wfh.at_main_freq_id
        AND wfh.asset_id = a.asset_id
        AND wfh.org_id = $2
      WHERE a.asset_id = $1 
        AND cl.org_id = $2
      ORDER BY cl.at_main_checklist_id ASC
    `;

    const result = await dbPool.query(query, [assetId, orgId]);
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