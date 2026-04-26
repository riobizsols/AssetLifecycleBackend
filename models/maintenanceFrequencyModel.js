const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

/** Stored values for on-demand rows. */
const ON_DEMAND_FREQUENCY = null;
const ON_DEMAND_UOM = null;
const ON_DEMAND_TEXT = 'On Demand';

// Helper function to get database connection (tenant pool or default)
const getDb = () => {
  const contextDb = getDbFromContext();
  return contextDb;
};

// Normalize UOM input to a valid UOM_id in tblUom.
const resolveUomId = async (dbPool, rawUom) => {
  const value = String(rawUom || '').trim();
  if (!value) return null;

  const byIdQuery = `SELECT UOM_id FROM "tblUom" WHERE UOM_id = $1 LIMIT 1`;
  const byIdResult = await dbPool.query(byIdQuery, [value]);
  if (byIdResult.rows.length > 0) {
    return byIdResult.rows[0].uom_id || byIdResult.rows[0].UOM_id;
  }

  const byTextQuery = `SELECT UOM_id FROM "tblUom" WHERE UOM = $1 LIMIT 1`;
  const byTextResult = await dbPool.query(byTextQuery, [value]);
  if (byTextResult.rows.length > 0) {
    return byTextResult.rows[0].uom_id || byTextResult.rows[0].UOM_id;
  }

  throw new Error(`Invalid UOM: "${value}". Please provide a valid UOM_id or UOM text.`);
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
          mf.is_recurring,
          mf.emp_int_id,
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
          is_recurring,
          emp_int_id
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
          mf.is_recurring,
          mf.emp_int_id,
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
  static async createMaintenanceFrequency(
    assetTypeId,
    frequency,
    uom,
    text,
    maintainedBy,
    maintTypeId,
    orgId,
    isRecurring = true,
    leadTime = null,
    empIntId = null
  ) {
    try {
      if (!isRecurring) {
        frequency = ON_DEMAND_FREQUENCY;
        uom = ON_DEMAND_UOM;
        text = (text && String(text).trim()) || ON_DEMAND_TEXT;
      } else {
        if (!uom || !uom.trim()) {
          throw new Error('UOM is required for recurring maintenance');
        }
      }
      
      const atMainFreqId = await generateCustomId('atmf', 3);
      const dbPool = getDb();
      
      const uomId = isRecurring ? await resolveUomId(dbPool, uom) : ON_DEMAND_UOM;
      
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
          org_id,
          is_recurring,
          emp_int_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10)
        RETURNING *
      `;
      const params = [
        atMainFreqId,
        assetTypeId,
        frequency,
        uomId,
        text?.trim() || (isRecurring && frequency ? `${frequency}` : ON_DEMAND_TEXT),
        maintainedBy,
        maintTypeId,
        orgId,
        isRecurring,
        empIntId || null
      ];
      const result = await dbPool.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating maintenance frequency:', error);
      throw error;
    }
  }

  // Update maintenance frequency
  static async updateMaintenanceFrequency(
    atMainFreqId,
    frequency,
    uom,
    text,
    maintainedBy,
    maintTypeId,
    orgId,
    isRecurring = true,
    empIntId = null
  ) {
    try {
      if (!isRecurring) {
        frequency = ON_DEMAND_FREQUENCY;
        uom = ON_DEMAND_UOM;
        text = (text && String(text).trim()) || ON_DEMAND_TEXT;
      } else {
        if (!uom || !uom.trim()) {
          throw new Error('UOM is required for recurring maintenance');
        }
      }
      
      const dbPool = getDb();
      
      const uomId = isRecurring ? await resolveUomId(dbPool, uom) : ON_DEMAND_UOM;
      
      const query = `
        UPDATE "tblATMaintFreq"
        SET 
          frequency = $1,
          uom = $2,
          text = $3,
          maintained_by = $4,
          maint_type_id = $5,
          is_recurring = $6,
          emp_int_id = $7
        WHERE at_main_freq_id = $8 AND org_id = $9
        RETURNING *
      `;
      
      const result = await dbPool.query(query, [
        frequency,
        uomId,
        text?.trim() || (isRecurring && frequency ? `${frequency}` : ON_DEMAND_TEXT),
        maintainedBy,
        maintTypeId,
        isRecurring,
        empIntId || null,
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

