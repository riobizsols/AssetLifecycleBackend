const db = require('../config/db');

class PropertiesModel {
  // Get properties for a specific asset type
  static async getPropertiesByAssetType(assetTypeId, orgId) {
    try {
      const query = `
        SELECT 
          p.prop_id,
          p.property,
          p.int_status
        FROM "tblProps" p
        INNER JOIN "tblAssetTypeProps" atp ON p.prop_id = atp.prop_id
        WHERE atp.asset_type_id = $1 
        AND p.org_id = $2 
        AND p.int_status = 1
        ORDER BY p.property
      `;
      
      const result = await db.query(query, [assetTypeId, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching properties by asset type:', error);
      throw error;
    }
  }

  // Get values for a specific property
  static async getPropertyValues(propId, orgId) {
    try {
      const query = `
        SELECT 
          aplv_id,
          value,
          int_status
        FROM "tblAssetPropListValues"
        WHERE prop_id = $1 
        AND org_id = $2 
        AND int_status = 1
        ORDER BY value
      `;
      
      const result = await db.query(query, [propId, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching property values:', error);
      throw error;
    }
  }

  // Get all properties with their values for a specific asset type
  static async getPropertiesWithValues(assetTypeId, orgId) {
    try {
      const query = `
        SELECT 
          p.prop_id,
          p.property,
          p.int_status,
          atp.asset_type_prop_id,
          json_agg(
            json_build_object(
              'aplv_id', v.aplv_id,
              'value', v.value,
              'int_status', v.int_status
            ) ORDER BY v.value
          ) as values
        FROM "tblProps" p
        INNER JOIN "tblAssetTypeProps" atp ON p.prop_id = atp.prop_id
        LEFT JOIN "tblAssetPropListValues" v ON p.prop_id = v.prop_id AND v.org_id = p.org_id AND v.int_status = 1
        WHERE atp.asset_type_id = $1 
        AND p.org_id = $2 
        AND p.int_status = 1
        GROUP BY p.prop_id, p.property, p.int_status, atp.asset_type_prop_id
        ORDER BY p.property
      `;
      
      const result = await db.query(query, [assetTypeId, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching properties with values:', error);
      throw error;
    }
  }

  // Get all asset types
  static async getAllAssetTypes(orgId) {
    try {
      const query = `
        SELECT 
          asset_type_id,
          text,
          int_status
        FROM "tblAssetTypes"
        WHERE org_id = $1 
        AND int_status = 1
        ORDER BY text
      `;
      
      const result = await db.query(query, [orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching asset types:', error);
      throw error;
    }
  }
}

module.exports = PropertiesModel; 