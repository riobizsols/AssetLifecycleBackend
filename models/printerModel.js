const db = require('../config/db');

class PrinterModel {
  // Get all printers for an organization
  static async getAllPrinters(orgId) {
    try {
      const query = `
        SELECT 
          printer_id,
          org_id,
          name,
          location,
          ip_address,
          status,
          printer_type,
          paper_size,
          paper_type,
          paper_quality,
          description,
          is_active,
          created_by,
          created_on,
          changed_by,
          changed_on,
          int_status
        FROM "tblPrinters"
        WHERE org_id = $1 
        AND int_status = 1
        ORDER BY name
      `;
      
      const result = await db.query(query, [orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching printers:', error);
      throw error;
    }
  }

  // Get printer by ID
  static async getPrinterById(printerId, orgId) {
    try {
      const query = `
        SELECT 
          printer_id,
          org_id,
          name,
          location,
          ip_address,
          status,
          printer_type,
          paper_size,
          paper_type,
          paper_quality,
          description,
          is_active,
          created_by,
          created_on,
          changed_by,
          changed_on,
          int_status
        FROM "tblPrinters"
        WHERE printer_id = $1 
        AND org_id = $2 
        AND int_status = 1
      `;
      
      const result = await db.query(query, [printerId, orgId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching printer by ID:', error);
      throw error;
    }
  }

  // Get printers by type
  static async getPrintersByType(printerType, orgId) {
    try {
      const query = `
        SELECT 
          printer_id,
          org_id,
          name,
          location,
          ip_address,
          status,
          printer_type,
          paper_size,
          paper_type,
          paper_quality,
          description,
          is_active
        FROM "tblPrinters"
        WHERE printer_type = $1 
        AND org_id = $2 
        AND int_status = 1
        AND is_active = true
        ORDER BY name
      `;
      
      const result = await db.query(query, [printerType, orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching printers by type:', error);
      throw error;
    }
  }

  // Get active printers
  static async getActivePrinters(orgId) {
    try {
      const query = `
        SELECT 
          printer_id,
          org_id,
          name,
          location,
          ip_address,
          status,
          printer_type,
          paper_size,
          paper_type,
          paper_quality,
          description
        FROM "tblPrinters"
        WHERE org_id = $1 
        AND int_status = 1
        AND is_active = true
        AND status = 'Online'
        ORDER BY name
      `;
      
      const result = await db.query(query, [orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching active printers:', error);
      throw error;
    }
  }

  // Create new printer
  static async createPrinter(printerData) {
    try {
      const {
        printer_id,
        org_id,
        name,
        location,
        ip_address,
        status,
        printer_type,
        paper_size,
        paper_type,
        paper_quality,
        description,
        created_by
      } = printerData;

      const query = `
        INSERT INTO "tblPrinters" (
          printer_id, org_id, name, location, ip_address, status,
          printer_type, paper_size, paper_type, paper_quality, description,
          created_by, created_on, changed_by, changed_on, int_status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
          CURRENT_TIMESTAMP, $12, CURRENT_TIMESTAMP, 1
        )
        RETURNING *
      `;
      
      const values = [
        printer_id, org_id, name, location, ip_address, status,
        printer_type, paper_size, paper_type, paper_quality, description,
        created_by
      ];
      
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating printer:', error);
      throw error;
    }
  }

  // Update printer
  static async updatePrinter(printerId, printerData, orgId, changedBy) {
    try {
      const {
        name,
        location,
        ip_address,
        status,
        printer_type,
        paper_size,
        paper_type,
        paper_quality,
        description,
        is_active
      } = printerData;

      const query = `
        UPDATE "tblPrinters"
        SET 
          name = $1,
          location = $2,
          ip_address = $3,
          status = $4,
          printer_type = $5,
          paper_size = $6,
          paper_type = $7,
          paper_quality = $8,
          description = $9,
          is_active = $10,
          changed_by = $11,
          changed_on = CURRENT_TIMESTAMP
        WHERE printer_id = $12 
        AND org_id = $13 
        AND int_status = 1
        RETURNING *
      `;
      
      const values = [
        name, location, ip_address, status, printer_type, paper_size,
        paper_type, paper_quality, description, is_active, changedBy,
        printerId, orgId
      ];
      
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating printer:', error);
      throw error;
    }
  }

  // Delete printer (soft delete)
  static async deletePrinter(printerId, orgId, changedBy) {
    try {
      const query = `
        UPDATE "tblPrinters"
        SET 
          int_status = 0,
          changed_by = $1,
          changed_on = CURRENT_TIMESTAMP
        WHERE printer_id = $2 
        AND org_id = $3
        RETURNING *
      `;
      
      const result = await db.query(query, [changedBy, printerId, orgId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting printer:', error);
      throw error;
    }
  }

  // Get printer statistics
  static async getPrinterStats(orgId) {
    try {
      const query = `
        SELECT 
          printer_type,
          status,
          COUNT(*) as count
        FROM "tblPrinters"
        WHERE org_id = $1 
        AND int_status = 1
        GROUP BY printer_type, status
        ORDER BY printer_type, status
      `;
      
      const result = await db.query(query, [orgId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching printer stats:', error);
      throw error;
    }
  }
}

module.exports = PrinterModel;
