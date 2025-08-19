const pool = require('../config/db');

// Reason Codes
const getBreakdownReasonCodes = async (orgId = 'ORG001', assetTypeId = null) => {
  let query = `
    SELECT atbrrc_id, asset_type_id, text, instatus, org_id
    FROM tblATBRReasonCodes
    WHERE instatus = 'A' AND org_id = $1
  `;
  const params = [orgId];
  if (assetTypeId) {
    query += ' AND asset_type_id = $2';
    params.push(assetTypeId);
  }
  query += ' ORDER BY text ASC';
  const result = await pool.query(query, params);
  return result.rows;
};

module.exports = { getBreakdownReasonCodes };


