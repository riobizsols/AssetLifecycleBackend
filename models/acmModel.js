const { getDbFromContext } = require('../utils/dbContext');

/**
 * Load active ACM rows for a user.
 * @param {string} userId
 * @param {object} [dbPool]
 * @returns {Promise<Array>}
 */
const getAcmRowsByUserId = async (userId, dbPool = null) => {
  const db = dbPool || getDbFromContext();
  const result = await db.query(
    `SELECT acm_id, user_id, access_level, org_id, branch_id, dept_id, int_status
     FROM "tblACM"
     WHERE user_id = $1 AND int_status = 1
     ORDER BY acm_id`,
    [userId]
  );
  return result.rows;
};

module.exports = {
  getAcmRowsByUserId,
};
