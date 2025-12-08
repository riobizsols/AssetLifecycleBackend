const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

const { generateCustomId } = require('../utils/idGenerator');

class AssetSerialPrintModel {
  // Add new serial number to print queue
  static async addToPrintQueue(serialData) {
    try {
      const {
        serial_no,
        status = 'pending',
        reason = null,
        created_by,
        org_id
      } = serialData;

      // Generate unique psnq_id
      const psnq_id = await generateCustomId("psnq", 3);

      const query = `
        INSERT INTO "tblPrintSerialNoQueue" (
          psnq_id,
          serial_no,
          status,
          reason,
          created_by,
          created_on,
          org_id
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
        RETURNING *
      `;

      const values = [
        psnq_id,
        serial_no,
        status,
        reason,
        created_by,
        org_id
      ];

      const dbPool = getDb();


      const result = await dbPool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error adding to print queue:', error);
      throw error;
    }
  }

  // Get all serial numbers in print queue with asset and asset type details
  // Supports super access users who can view all branches
  static async getAllPrintQueue(orgId, branchId = null, hasSuperAccess = false) {
    try {
      let query = `
        SELECT 
          psq.psnq_id,
          psq.serial_no,
          psq.status,
          psq.reason,
          psq.created_by,
          psq.created_on,
          psq.org_id,
          a.asset_id,
          a.text as asset_name,
          a.serial_number as asset_serial_number,
          a.purchased_on,
          a.expiry_date,
          a.current_status,
          at.asset_type_id,
          at.text as asset_type_name,
          at.assignment_type,
          at.maint_required,
          at.inspection_required,
          at.group_required
        FROM "tblPrintSerialNoQueue" psq
        LEFT JOIN "tblAssets" a ON psq.serial_no = a.serial_number AND a.org_id = psq.org_id
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id AND at.org_id = psq.org_id
        WHERE psq.org_id = $1
      `;
      
      const params = [orgId];
      
      // Apply branch filter only if user doesn't have super access and branchId is provided
      // Filter by asset's branch_id when the serial number is linked to an asset
      if (!hasSuperAccess && branchId) {
        query += ` AND (a.branch_id = $2 OR a.asset_id IS NULL)`;
        params.push(branchId);
      }
      
      query += ` ORDER BY psq.created_on DESC`;

      const dbPool = getDb();
      const result = await dbPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching print queue:', error);
      throw error;
    }
  }

  // Get print queue by status with asset and asset type details
  // Supports super access users who can view all branches
  static async getPrintQueueByStatus(orgId, status, branchId = null, hasSuperAccess = false) {
    try {
      let query = `
        SELECT 
          psq.psnq_id,
          psq.serial_no,
          psq.status,
          psq.reason,
          psq.created_by,
          psq.created_on,
          psq.org_id,
          a.asset_id,
          a.text as asset_name,
          a.serial_number as asset_serial_number,
          a.purchased_on,
          a.expiry_date,
          a.current_status,
          at.asset_type_id,
          at.text as asset_type_name,
          at.assignment_type,
          at.maint_required,
          at.inspection_required,
          at.group_required
        FROM "tblPrintSerialNoQueue" psq
        LEFT JOIN "tblAssets" a ON psq.serial_no = a.serial_number AND a.org_id = psq.org_id
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id AND at.org_id = psq.org_id
        WHERE psq.org_id = $1 AND psq.status = $2
      `;
      
      const params = [orgId, status];
      
      // Apply branch filter only if user doesn't have super access and branchId is provided
      // Filter by asset's branch_id when the serial number is linked to an asset
      if (!hasSuperAccess && branchId) {
        query += ` AND (a.branch_id = $3 OR a.asset_id IS NULL)`;
        params.push(branchId);
      }
      
      query += ` ORDER BY psq.created_on DESC`;

      const dbPool = getDb();
      const result = await dbPool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error fetching print queue by status:', error);
      throw error;
    }
  }

  // Update print queue status
  static async updatePrintStatus(psnqId, status, orgId) {
    try {
      const query = `
        UPDATE "tblPrintSerialNoQueue"
        SET status = $1
        WHERE psnq_id = $2 AND org_id = $3
        RETURNING *
      `;

      const dbPool = getDb();


      const result = await dbPool.query(query, [status, psnqId, orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating print status:', error);
      throw error;
    }
  }

  // Delete from print queue
  static async deleteFromPrintQueue(psnqId, orgId) {
    try {
      const query = `
        DELETE FROM "tblPrintSerialNoQueue"
        WHERE psnq_id = $1 AND org_id = $2
        RETURNING *
      `;

      const dbPool = getDb();


      const result = await dbPool.query(query, [psnqId, orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting from print queue:', error);
      throw error;
    }
  }

  // Get print queue by ID
  static async getPrintQueueById(psnqId, orgId) {
    try {
      const query = `
        SELECT 
          psq.psnq_id,
          psq.serial_no,
          psq.status,
          psq.reason,
          psq.created_by,
          psq.created_on,
          psq.org_id,
          a.asset_id,
          a.text as asset_name,
          a.serial_number as asset_serial_number,
          a.purchased_on,
          a.expiry_date,
          a.current_status,
          at.asset_type_id,
          at.text as asset_type_name,
          at.assignment_type,
          at.maint_required,
          at.inspection_required,
          at.group_required
        FROM "tblPrintSerialNoQueue" psq
        LEFT JOIN "tblAssets" a ON psq.serial_no = a.serial_number AND a.org_id = psq.org_id
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id AND at.org_id = psq.org_id
        WHERE psq.psnq_id = $1 AND psq.org_id = $2
      `;

      const dbPool = getDb();


      const result = await dbPool.query(query, [psnqId, orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching print queue by ID:', error);
      throw error;
    }
  }
}

module.exports = AssetSerialPrintModel;
