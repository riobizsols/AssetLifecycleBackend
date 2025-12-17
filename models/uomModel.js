const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => {
  const contextDb = getDbFromContext();
  return contextDb;
};

class UOMModel {
  // Get all UOM values
  static async getAllUOM(orgId) {
    try {
      const dbPool = getDb();
      // Query UOM table - try with org_id first, fallback to simple query
      let query = `
        SELECT 
          UOM_id,
          UOM
        FROM "tblUom"
        ORDER BY UOM
      `;
      
      try {
        // Try query with org_id filter
        query = `
          SELECT 
            UOM_id,
            UOM
          FROM "tblUom"
          WHERE org_id = $1 OR org_id IS NULL
          ORDER BY UOM
        `;
        const result = await dbPool.query(query, [orgId]);
        return result.rows;
      } catch (err) {
        // If org_id column doesn't exist, use simple query without filter
        if (err.code === '42703' || (err.message && err.message.includes('org_id'))) {
          const result = await dbPool.query(`
            SELECT 
              UOM_id,
              UOM
            FROM "tblUom"
            ORDER BY UOM
          `);
          return result.rows;
        }
        throw err;
      }
    } catch (error) {
      console.error('Error fetching UOM values:', error);
      throw error;
    }
  }

  // Get UOM by ID
  static async getUOMById(uomId, orgId) {
    try {
      const dbPool = getDb();
      
      try {
        // Try query with org_id filter
        const query = `
          SELECT 
            UOM_id,
            UOM
          FROM "tblUom"
          WHERE UOM_id = $1 
          AND (org_id = $2 OR org_id IS NULL)
        `;
        const result = await dbPool.query(query, [uomId, orgId]);
        return result.rows[0] || null;
      } catch (err) {
        // If org_id column doesn't exist, use simple query
        if (err.code === '42703' || (err.message && err.message.includes('org_id'))) {
          const query = `
            SELECT 
              UOM_id,
              UOM
            FROM "tblUom"
            WHERE UOM_id = $1
          `;
          const result = await dbPool.query(query, [uomId]);
          return result.rows[0] || null;
        }
        throw err;
      }
    } catch (error) {
      console.error('Error fetching UOM by ID:', error);
      throw error;
    }
  }
}

module.exports = UOMModel;

