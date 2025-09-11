const PrinterModel = require('../models/printerModel');
const { generateCustomId } = require('../utils/idGenerator');

class PrinterController {
  // Get all printers
  static async getAllPrinters(req, res) {
    try {
      const orgId = req.user.org_id;
      console.log(`Fetching printers for org: ${orgId}`);

      const printers = await PrinterModel.getAllPrinters(orgId);
      
      res.json({
        success: true,
        data: printers,
        count: printers.length
      });
    } catch (error) {
      console.error('Error in getAllPrinters:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch printers',
        error: error.message
      });
    }
  }

  // Get printer by ID
  static async getPrinterById(req, res) {
    try {
      const { printerId } = req.params;
      const orgId = req.user.org_id;

      const printer = await PrinterModel.getPrinterById(printerId, orgId);
      
      if (!printer) {
        return res.status(404).json({
          success: false,
          message: 'Printer not found'
        });
      }

      res.json({
        success: true,
        data: printer
      });
    } catch (error) {
      console.error('Error in getPrinterById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch printer',
        error: error.message
      });
    }
  }

  // Get printers by type
  static async getPrintersByType(req, res) {
    try {
      const { printerType } = req.params;
      const orgId = req.user.org_id;

      const printers = await PrinterModel.getPrintersByType(printerType, orgId);
      
      res.json({
        success: true,
        data: printers,
        count: printers.length
      });
    } catch (error) {
      console.error('Error in getPrintersByType:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch printers by type',
        error: error.message
      });
    }
  }

  // Get active printers
  static async getActivePrinters(req, res) {
    try {
      const orgId = req.user.org_id;

      const printers = await PrinterModel.getActivePrinters(orgId);
      
      res.json({
        success: true,
        data: printers,
        count: printers.length
      });
    } catch (error) {
      console.error('Error in getActivePrinters:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active printers',
        error: error.message
      });
    }
  }

  // Create new printer
  static async createPrinter(req, res) {
    try {
      const orgId = req.user.org_id;
      const createdBy = req.user.user_id;
      
      const {
        name,
        location,
        ip_address,
        status = 'Online',
        printer_type,
        paper_size,
        paper_type,
        paper_quality = 'Normal',
        description
      } = req.body;

      // Validate required fields
      if (!name || !printer_type) {
        return res.status(400).json({
          success: false,
          message: 'Name and printer type are required'
        });
      }

      // Generate printer ID
      const printerId = await generateCustomId('printer', 3);

      const printerData = {
        printer_id: printerId,
        org_id: orgId,
        name,
        location,
        ip_address,
        status,
        printer_type,
        paper_size,
        paper_type,
        paper_quality,
        description,
        created_by: createdBy
      };

      const newPrinter = await PrinterModel.createPrinter(printerData);

      res.status(201).json({
        success: true,
        message: 'Printer created successfully',
        data: newPrinter
      });
    } catch (error) {
      console.error('Error in createPrinter:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create printer',
        error: error.message
      });
    }
  }

  // Update printer
  static async updatePrinter(req, res) {
    try {
      const { printerId } = req.params;
      const orgId = req.user.org_id;
      const changedBy = req.user.user_id;
      
      const updateData = req.body;

      const updatedPrinter = await PrinterModel.updatePrinter(printerId, updateData, orgId, changedBy);

      if (!updatedPrinter) {
        return res.status(404).json({
          success: false,
          message: 'Printer not found'
        });
      }

      res.json({
        success: true,
        message: 'Printer updated successfully',
        data: updatedPrinter
      });
    } catch (error) {
      console.error('Error in updatePrinter:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update printer',
        error: error.message
      });
    }
  }

  // Delete printer
  static async deletePrinter(req, res) {
    try {
      const { printerId } = req.params;
      const orgId = req.user.org_id;
      const changedBy = req.user.user_id;

      const deletedPrinter = await PrinterModel.deletePrinter(printerId, orgId, changedBy);

      if (!deletedPrinter) {
        return res.status(404).json({
          success: false,
          message: 'Printer not found'
        });
      }

      res.json({
        success: true,
        message: 'Printer deleted successfully',
        data: deletedPrinter
      });
    } catch (error) {
      console.error('Error in deletePrinter:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete printer',
        error: error.message
      });
    }
  }

  // Get printer statistics
  static async getPrinterStats(req, res) {
    try {
      const orgId = req.user.org_id;

      const stats = await PrinterModel.getPrinterStats(orgId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error in getPrinterStats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch printer statistics',
        error: error.message
      });
    }
  }
}

module.exports = PrinterController;
