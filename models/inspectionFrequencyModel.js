const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

class InspectionFrequencyModel {
  static async getAllInspectionFrequencies(orgId) {
    try {
      const dbPool = getDb();
      const query = `
        SELECT 
          f.aatif_id,
          f.aatic_id,
          f.freq,
          f.uom,
          f.text,
          f.maintained_by,
          f.int_status,
          f.org_id,
          f.is_recurring,
          at.text as asset_type_name,
          at.asset_type_id,
          a.text as asset_name,
          a.asset_id
        FROM "tblAAT_Insp_Freq" f
        LEFT JOIN "tblAATInspCheckList" m ON f.aatic_id = m.aatic_id
        LEFT JOIN "tblAssetTypes" at ON m.at_id = at.asset_type_id
        LEFT JOIN "tblAssets" a ON m.asset_id = a.asset_id
        WHERE f.org_id = $1 
        AND f.int_status = 1
        ORDER BY at.text, f.text
      `;
      
      const result = await dbPool.query(query, [orgId]);
      return result.rows || [];
    } catch (error) {
      console.error('Error in getAllInspectionFrequencies:', error);
      // Return empty array instead of throwing to prevent frontend errors
      return [];
    }
  }

  static async createInspectionFrequency(data, orgId, userId) {
    try {
      const dbPool = getDb();
      const aatif_id = await generateCustomId('aatif_id', 'tblAAT_Insp_Freq');
      // normalize maintained_by to 'inhouse' and accept uom as an ID
      const maintainedBy = data.maintained_by
        ? String(data.maintained_by).replace(/\s|-/g, '').toLowerCase()
        : 'inhouse';

      let uomValue = null;
      if (data.uom !== undefined && data.uom !== null) {
        if (typeof data.uom === 'object' && data.uom.id !== undefined) uomValue = data.uom.id;
        else uomValue = data.uom;
        if (!isNaN(Number(uomValue))) uomValue = Number(uomValue);
      }

      const query = `
        INSERT INTO "tblAAT_Insp_Freq" (
          aatif_id, aatic_id, freq, uom, text, 
          maintained_by, org_id, is_recurring, emp_int_id,
          created_by, changed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const result = await dbPool.query(query, [
        aatif_id,
        data.aatic_id,
        data.freq || null,
        uomValue,
        data.text || null,
        maintainedBy,
        orgId,
        data.is_recurring !== undefined ? data.is_recurring : true,
        data.emp_int_id || null,
        userId,
        userId
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error in createInspectionFrequency:', error);
      throw error;
    }
  }

  static async updateInspectionFrequency(id, data, orgId, userId) {
    try {
      const dbPool = getDb();
      // normalize maintained_by to 'inhouse' and accept uom as an ID
      const maintainedBy = data.maintained_by
        ? String(data.maintained_by).replace(/\s|-/g, '').toLowerCase()
        : 'inhouse';

      let uomValue = null;
      if (data.uom !== undefined && data.uom !== null) {
        if (typeof data.uom === 'object' && data.uom.id !== undefined) uomValue = data.uom.id;
        else uomValue = data.uom;
        if (!isNaN(Number(uomValue))) uomValue = Number(uomValue);
      }

      const query = `
        UPDATE "tblAAT_Insp_Freq" 
        SET 
          freq = $1,
          uom = $2,
          text = $3,
          maintained_by = $4,
          is_recurring = $5,
          emp_int_id = $6,
          changed_by = $7,
          changed_on = CURRENT_TIMESTAMP
        WHERE aatif_id = $8 AND org_id = $9
        RETURNING *
      `;
      
      const result = await dbPool.query(query, [
        data.freq || null,
        uomValue,
        data.text || null,
        maintainedBy,
        data.is_recurring !== undefined ? data.is_recurring : true,
        data.emp_int_id || null,
        userId,
        id,
        orgId
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error in updateInspectionFrequency:', error);
      throw error;
    }
  }

  static async deleteInspectionFrequency(id, orgId) {
    try {
      const dbPool = getDb();
      const query = `DELETE FROM "tblAAT_Insp_Freq" WHERE aatif_id = $1 AND org_id = $2`;
      const result = await dbPool.query(query, [id, orgId]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error in deleteInspectionFrequency:', error);
      throw error;
    }
  }
}

module.exports = InspectionFrequencyModel;
