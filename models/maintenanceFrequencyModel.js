const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

// Helper function to get database connection (tenant pool or default)
const getDb = () => {
  const contextDb = getDbFromContext();
  return contextDb;
};

class MaintenanceFrequencyModel {
  // Get all maintenance frequencies with asset type info
  static async getAllMaintenanceFrequencies(orgId) {
    try {
      const dbPool = getDb();
      const query = `
        SELECT 
          mf.at_main_freq_id,
          mf.asset_type_id,
          mf.frequency,
          mf.uom,
          mf.text,
          mf.maintained_by,
          mf.maint_type_id,
          mf.int_status,
          mf.org_id,
          at.text as asset_type_name,
          at.maint_lead_type,
          mt.text as maint_type_name
        FROM "tblATMaintFreq" mf
        LEFT JOIN "tblAssetTypes" at ON mf.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON mf.maint_type_id = mt.maint_type_id
        WHERE mf.org_id = $1 
        AND mf.int_status = 1
        ORDER BY at.text, mf.text
      `;
      
      const result = await dbPool.query(query, [orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching all maintenance frequencies:', error);
      throw error;
    }
  }

  // Get maintenance frequencies by asset type
  static async getMaintenanceFrequenciesByAssetType(assetTypeId, orgId) {
    try {
      const dbPool = getDb();
      const query = `
        SELECT 
          at_main_freq_id,
          asset_type_id,
          frequency,
          uom,
          text,
          maintained_by,
          maint_type_id,
          int_status,
          org_id,
          COALESCE(lead_time, NULL) as lead_time
        FROM "tblATMaintFreq"
        WHERE asset_type_id = $1 
        AND org_id = $2 
        AND int_status = 1
        ORDER BY text
      `;
      
      const result = await dbPool.query(query, [assetTypeId, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching maintenance frequencies by asset type:', error);
      throw error;
    }
  }

  // Get maintenance frequency by ID
  static async getMaintenanceFrequencyById(atMainFreqId, orgId) {
    try {
      const dbPool = getDb();
      const query = `
        SELECT 
          mf.at_main_freq_id,
          mf.asset_type_id,
          mf.frequency,
          mf.uom,
          mf.text,
          mf.maintained_by,
          mf.maint_type_id,
          mf.int_status,
          mf.org_id,
          COALESCE(mf.lead_time, NULL) as lead_time,
          at.text as asset_type_name,
          at.maint_lead_type,
          mt.text as maint_type_name
        FROM "tblATMaintFreq" mf
        LEFT JOIN "tblAssetTypes" at ON mf.asset_type_id = at.asset_type_id
        LEFT JOIN "tblMaintTypes" mt ON mf.maint_type_id = mt.maint_type_id
        WHERE mf.at_main_freq_id = $1 
        AND mf.org_id = $2
      `;
      
      const result = await dbPool.query(query, [atMainFreqId, orgId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching maintenance frequency by ID:', error);
      throw error;
    }
  }

  // Create maintenance frequency
  static async createMaintenanceFrequency(assetTypeId, frequency, uom, text, maintainedBy, maintTypeId, orgId, leadTime = null) {
    try {
      // Validate UOM is provided
      if (!uom || !uom.trim()) {
        throw new Error('UOM is required and cannot be empty');
      }
      
      const atMainFreqId = await generateCustomId('atmf', 3);
      const dbPool = getDb();
      
      // If uom is an ID, look up the UOM text from tblUom
      let uomText = uom.trim();
      
      // Try to look up UOM text from UOM_id (if it's an ID)
      try {
        const uomQuery = `SELECT UOM FROM "tblUom" WHERE UOM_id = $1 LIMIT 1`;
        const uomResult = await dbPool.query(uomQuery, [uomText]);
        if (uomResult.rows.length > 0 && uomResult.rows[0].UOM) {
          uomText = uomResult.rows[0].UOM;
          console.log(`Found UOM text for ID ${uom}: ${uomText}`);
        } else {
          // If not found by ID, check if it's already a valid UOM text
          const uomTextQuery = `SELECT UOM FROM "tblUom" WHERE UOM = $1 LIMIT 1`;
          const uomTextResult = await dbPool.query(uomTextQuery, [uomText]);
          if (uomTextResult.rows.length === 0) {
            console.warn(`UOM "${uomText}" not found in tblUom. Using provided value.`);
          } else {
            console.log(`UOM text "${uomText}" exists in tblUom`);
          }
        }
      } catch (uomError) {
        // If lookup fails, use the provided value as-is
        console.log('Could not look up UOM, using provided value:', uomText);
        console.error('UOM lookup error:', uomError);
      }
      
      // Ensure uomText is not null or empty
      if (!uomText || !uomText.trim()) {
        throw new Error('UOM text cannot be null or empty after lookup');
      }
      
      // Insert maintenance frequency
      const query = `
        INSERT INTO "tblATMaintFreq" (
          at_main_freq_id,
          asset_type_id,
          frequency,
          uom,
          text,
          maintained_by,
          maint_type_id,
          int_status,
          org_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
        RETURNING *
      `;
      const params = [
        atMainFreqId,
        assetTypeId,
        frequency,
        uomText.trim(),
        text?.trim() || `${frequency} ${uomText.trim()}`,
        maintainedBy,
        maintTypeId,
        orgId
      ];
      const result = await dbPool.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating maintenance frequency:', error);
      throw error;
    }
  }

  // Update maintenance frequency
  static async updateMaintenanceFrequency(atMainFreqId, frequency, uom, text, maintainedBy, maintTypeId, orgId) {
    try {
      // Validate UOM is provided
      if (!uom || !uom.trim()) {
        throw new Error('UOM is required and cannot be empty');
      }
      
      const dbPool = getDb();
      
      // If uom is an ID, look up the UOM text from tblUom
      let uomText = uom.trim();
      
      // Try to look up UOM text from UOM_id (if it's an ID)
      try {
        const uomQuery = `SELECT UOM FROM "tblUom" WHERE UOM_id = $1 LIMIT 1`;
        const uomResult = await dbPool.query(uomQuery, [uomText]);
        if (uomResult.rows.length > 0 && uomResult.rows[0].UOM) {
          uomText = uomResult.rows[0].UOM;
          console.log(`Found UOM text for ID ${uom}: ${uomText}`);
        } else {
          // If not found by ID, check if it's already a valid UOM text
          const uomTextQuery = `SELECT UOM FROM "tblUom" WHERE UOM = $1 LIMIT 1`;
          const uomTextResult = await dbPool.query(uomTextQuery, [uomText]);
          if (uomTextResult.rows.length === 0) {
            console.warn(`UOM "${uomText}" not found in tblUom. Using provided value.`);
          } else {
            console.log(`UOM text "${uomText}" exists in tblUom`);
          }
        }
      } catch (uomError) {
        // If lookup fails, use the provided value as-is
        console.log('Could not look up UOM, using provided value:', uomText);
        console.error('UOM lookup error:', uomError);
      }
      
      // Ensure uomText is not null or empty
      if (!uomText || !uomText.trim()) {
        throw new Error('UOM text cannot be null or empty after lookup');
      }
      
      const query = `
        UPDATE "tblATMaintFreq"
        SET 
          frequency = $1,
          uom = $2,
          text = $3,
          maintained_by = $4,
          maint_type_id = $5
        WHERE at_main_freq_id = $6 AND org_id = $7
        RETURNING *
      `;
      
      const result = await dbPool.query(query, [
        frequency,
        uomText.trim(),
        text?.trim() || `${frequency} ${uomText.trim()}`,
        maintainedBy,
        maintTypeId,
        atMainFreqId,
        orgId
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating maintenance frequency:', error);
      throw error;
    }
  }

  // Delete maintenance frequency (soft delete)
  static async deleteMaintenanceFrequency(atMainFreqId, orgId) {
    try {
      const query = `
        UPDATE "tblATMaintFreq"
        SET int_status = 0
        WHERE at_main_freq_id = $1 AND org_id = $2
        RETURNING *
      `;
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [atMainFreqId, orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting maintenance frequency:', error);
      throw error;
    }
  }

  // Get checklist items for a maintenance frequency
  static async getChecklistItems(atMainFreqId, orgId) {
    try {
      const dbPool = getDb();
      const query = `
        SELECT 
          at_main_checklist_id,
          org_id,
          asset_type_id,
          text,
          at_main_freq_id
        FROM "tblATMaintCheckList"
        WHERE at_main_freq_id = $1 
        AND org_id = $2
        ORDER BY at_main_checklist_id ASC
      `;
      
      const result = await dbPool.query(query, [atMainFreqId, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching checklist items:', error);
      throw error;
    }
  }

  // Add checklist item
  static async addChecklistItem(assetTypeId, atMainFreqId, text, orgId) {
    try {
      const atMainChecklistId = await generateCustomId('atmcl', 3);
      
      const query = `
        INSERT INTO "tblATMaintCheckList" (
          at_main_checklist_id,
          org_id,
          asset_type_id,
          text,
          at_main_freq_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [
        atMainChecklistId,
        orgId,
        assetTypeId,
        text,
        atMainFreqId
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error adding checklist item:', error);
      throw error;
    }
  }

  // Delete checklist item
  static async deleteChecklistItem(atMainChecklistId, orgId) {
    try {
      const query = `
        DELETE FROM "tblATMaintCheckList"
        WHERE at_main_checklist_id = $1 AND org_id = $2
        RETURNING *
      `;
      
      const dbPool = getDb();
      const result = await dbPool.query(query, [atMainChecklistId, orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      throw error;
    }
  }
}

module.exports = MaintenanceFrequencyModel;

