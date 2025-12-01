const db = require('../config/db');
const { getDb: getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

// Helper function to get database connection (tenant pool or default)
const getDb = () => {
  const contextDb = getDbFromContext();
  return contextDb;
};

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
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [assetTypeId, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching properties by asset type:', error);
      throw error;
    }
  }

  // Get values for a specific property
  static async getPropertyValues(propId, orgId) {
    try {
      const dbPool = getDb();
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
      
      const result = await dbPool.query(query, [propId, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching property values:', error);
      throw error;
    }
  }

  // Create a new property value
  static async createPropertyValue(propId, value, orgId, createdBy) {
    try {
      const { generateCustomId } = require('../utils/idGenerator');
      
      // Generate unique APLV ID
      const aplvId = await generateCustomId('aplv', 3);
      
      const query = `
        INSERT INTO "tblAssetPropListValues" (
          aplv_id,
          prop_id,
          value,
          int_status,
          org_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING aplv_id
      `;
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [aplvId, propId, value, 1, orgId]);
      console.log(`✅ Created new property value: ${value} for property ${propId} with ID ${aplvId}`);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating property value:', error);
      throw error;
    }
  }

  // Check if property value exists (case-insensitive)
  static async findPropertyValue(propId, value, orgId) {
    try {
      const dbPool = getDb();
      const query = `
        SELECT 
          aplv_id,
          value,
          int_status
        FROM "tblAssetPropListValues"
        WHERE prop_id = $1 
        AND org_id = $2 
        AND int_status = 1
        AND LOWER(value) = LOWER($3)
        ORDER BY value
      `;
      
      const result = await dbPool.query(query, [propId, orgId, value]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding property value:', error);
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
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [assetTypeId, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching properties with values:', error);
      throw error;
    }
  }

  // Add new property value to tblAssetPropListValues
  static async addPropertyValue(propId, value, orgId) {
    try {
      const dbPool = getDb();
      // First, get the next aplv_id by finding the highest existing aplv_id for this prop_id
      const maxIdQuery = `
        SELECT COALESCE(MAX(CAST(SUBSTRING(aplv_id FROM 4) AS INTEGER)), 0) as max_id
        FROM "tblAssetPropListValues"
        WHERE prop_id = $1 AND org_id = $2
      `;
      const maxIdResult = await dbPool.query(maxIdQuery, [propId, orgId]);
      const nextId = (maxIdResult.rows[0].max_id || 0) + 1;
      const aplvId = `APL${nextId.toString().padStart(6, '0')}`;

      const query = `
        INSERT INTO "tblAssetPropListValues" (
          aplv_id, prop_id, value, org_id, int_status
        ) VALUES ($1, $2, $3, $4, 1)
        RETURNING *
      `;
      
      const result = await dbPool.query(query, [aplvId, propId, value, orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error adding property value:', error);
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
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching asset types:', error);
      throw error;
    }
  }

  // Get all properties
  static async getAllProperties(orgId) {
    try {
      const dbPool = getDb();
      const query = `
        SELECT 
          prop_id,
          property,
          int_status
        FROM "tblProps"
        WHERE org_id = $1 
        AND int_status = 1
        ORDER BY property
      `;
      
      const result = await dbPool.query(query, [orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching all properties:', error);
      throw error;
    }
  }

  // Map properties to existing asset type
  static async mapPropertiesToAssetType(assetTypeId, propertyIds, orgId, createdBy) {
    const dbPool = getDb();
    const client = await dbPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // First, verify that the asset type exists
      const assetTypeCheckQuery = `
        SELECT asset_type_id FROM "tblAssetTypes"
        WHERE asset_type_id = $1 AND org_id = $2
      `;
      
      const assetTypeResult = await client.query(assetTypeCheckQuery, [assetTypeId, orgId]);
      
      if (assetTypeResult.rows.length === 0) {
        throw new Error(`Asset type ${assetTypeId} not found`);
      }
      
      // Clear existing property mappings for this asset type
      const deleteExistingQuery = `
        DELETE FROM "tblAssetTypeProps"
        WHERE asset_type_id = $1 AND org_id = $2
      `;
      
      await client.query(deleteExistingQuery, [assetTypeId, orgId]);
      
      // Map new properties to the asset type
      const mappedProperties = [];
      
      if (propertyIds && propertyIds.length > 0) {
        for (const propId of propertyIds) {
          // Verify that the property exists
          const propertyCheckQuery = `
            SELECT prop_id FROM "tblProps"
            WHERE prop_id = $1 AND org_id = $2 AND int_status = 1
          `;
          
          const propertyResult = await client.query(propertyCheckQuery, [propId, orgId]);
          
          if (propertyResult.rows.length === 0) {
            throw new Error(`Property ${propId} not found or inactive`);
          }
          
          // Generate unique asset_type_prop_id in ATP001 format
          const assetTypePropId = await generateCustomId("asset_type_prop", 3);
          
          const mappingQuery = `
            INSERT INTO "tblAssetTypeProps" (
              asset_type_prop_id, asset_type_id, prop_id, org_id
            ) VALUES ($1, $2, $3, $4)
          `;
          
          await client.query(mappingQuery, [
            assetTypePropId,
            assetTypeId,
            propId,
            orgId
          ]);
          
          mappedProperties.push(propId);
        }
      }
      
      await client.query('COMMIT');
      
      return {
        mappedProperties: mappedProperties
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error mapping properties to asset type:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PropertiesModel; 