const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

// Helper function to get database connection (tenant pool or default)
const getDb = () => {
  const contextDb = getDbFromContext();
  return contextDb;
};

class BreakdownReasonCodesModel {
  // Get all breakdown reason codes
  static async getAllReasonCodes(orgId) {
    try {
      const dbPool = getDb();
      const query = `
        SELECT 
          r.atbrrc_id,
          r.asset_type_id,
          r.text,
          r.instatus,
          r.org_id,
          at.text as asset_type_name
        FROM "tblATBRReasonCodes" r
        LEFT JOIN "tblAssetTypes" at ON r.asset_type_id = at.asset_type_id
        WHERE r.org_id = $1 
        AND r.instatus = '1'
        ORDER BY at.text, r.text
      `;
      
      const result = await dbPool.query(query, [orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching all breakdown reason codes:', error);
      throw error;
    }
  }

  // Get breakdown reason codes by asset type
  static async getReasonCodesByAssetType(assetTypeId, orgId) {
    try {
      const dbPool = getDb();
      const query = `
        SELECT 
          atbrrc_id,
          asset_type_id,
          text,
          instatus,
          org_id
        FROM "tblATBRReasonCodes"
        WHERE asset_type_id = $1 
        AND org_id = $2 
        AND instatus = '1'
        ORDER BY text
      `;
      
      const result = await dbPool.query(query, [assetTypeId, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching breakdown reason codes by asset type:', error);
      throw error;
    }
  }

  // Create a new breakdown reason code
  static async createReasonCode(assetTypeId, text, orgId) {
    try {
      const atbrrcId = await generateCustomId('atbrrc', 3);
      
      const query = `
        INSERT INTO "tblATBRReasonCodes" (
          atbrrc_id,
          asset_type_id,
          text,
          instatus,
          org_id
        ) VALUES ($1, $2, $3, '1', $4)
        RETURNING *
      `;
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [atbrrcId, assetTypeId, text.trim(), orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating breakdown reason code:', error);
      throw error;
    }
  }

  // Update breakdown reason code
  static async updateReasonCode(atbrrcId, text, orgId) {
    try {
      const query = `
        UPDATE "tblATBRReasonCodes"
        SET text = $1
        WHERE atbrrc_id = $2 AND org_id = $3
        RETURNING *
      `;
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [text.trim(), atbrrcId, orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating breakdown reason code:', error);
      throw error;
    }
  }

  // Delete breakdown reason code (soft delete by setting instatus = '0')
  static async deleteReasonCode(atbrrcId, orgId) {
    try {
      const query = `
        UPDATE "tblATBRReasonCodes"
        SET instatus = '0'
        WHERE atbrrc_id = $1 AND org_id = $2
        RETURNING *
      `;
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [atbrrcId, orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting breakdown reason code:', error);
      throw error;
    }
  }
}

module.exports = BreakdownReasonCodesModel;

