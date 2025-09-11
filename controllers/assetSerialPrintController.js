const AssetSerialPrintModel = require('../models/assetSerialPrintModel');

class AssetSerialPrintController {
  // Add serial number to print queue
  static async addToPrintQueue(req, res) {
    try {
      const orgId = req.user.org_id;
      const createdBy = req.user.user_id;

      const {
        serial_no,
        status = 'pending',
        reason = null
      } = req.body;

      console.log(`Adding serial number to print queue for org: ${orgId}`);
      console.log('Serial number:', serial_no);
      console.log('Status:', status);
      console.log('Reason:', reason);

      // Validate required fields
      if (!serial_no) {
        return res.status(400).json({
          success: false,
          message: 'Serial number is required'
        });
      }

      // Prepare data for model
      const serialData = {
        serial_no,
        status,
        reason,
        created_by: createdBy,
        org_id: orgId
      };

      // Add to print queue
      const result = await AssetSerialPrintModel.addToPrintQueue(serialData);

      console.log(`Successfully added serial number to print queue: ${result.psnq_id}`);

      res.status(201).json({
        success: true,
        message: 'Serial number added to print queue successfully',
        data: result
      });

    } catch (error) {
      console.error('Error in addToPrintQueue:', error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'Serial number already exists in print queue',
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to add serial number to print queue',
        error: error.message
      });
    }
  }

  // Get all serial numbers in print queue
  static async getAllPrintQueue(req, res) {
    try {
      const orgId = req.user.org_id;

      console.log(`Fetching all print queue items for org: ${orgId}`);

      const printQueue = await AssetSerialPrintModel.getAllPrintQueue(orgId);

      console.log(`Found ${printQueue.length} items in print queue`);

      // Format response with asset and asset type details
      const formattedData = printQueue.map(item => ({
        psnq_id: item.psnq_id,
        serial_no: item.serial_no,
        status: item.status,
        reason: item.reason,
        created_by: item.created_by,
        created_on: item.created_on,
        org_id: item.org_id,
        asset_details: {
          asset_id: item.asset_id,
          asset_name: item.asset_name,
          asset_serial_number: item.asset_serial_number,
          purchased_on: item.purchased_on,
          expiry_date: item.expiry_date,
          current_status: item.current_status
        },
        asset_type_details: {
          asset_type_id: item.asset_type_id,
          asset_type_name: item.asset_type_name,
          assignment_type: item.assignment_type,
          maint_required: item.maint_required,
          inspection_required: item.inspection_required,
          group_required: item.group_required
        }
      }));

      res.json({
        success: true,
        data: formattedData,
        total: formattedData.length
      });

    } catch (error) {
      console.error('Error in getAllPrintQueue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch print queue',
        error: error.message
      });
    }
  }

  // Get print queue by status
  static async getPrintQueueByStatus(req, res) {
    try {
      const orgId = req.user.org_id;
      const { status } = req.params;

      console.log(`Fetching print queue items with status: ${status} for org: ${orgId}`);

      const printQueue = await AssetSerialPrintModel.getPrintQueueByStatus(orgId, status);

      console.log(`Found ${printQueue.length} items with status: ${status}`);

      // Format response with asset and asset type details
      const formattedData = printQueue.map(item => ({
        psnq_id: item.psnq_id,
        serial_no: item.serial_no,
        status: item.status,
        reason: item.reason,
        created_by: item.created_by,
        created_on: item.created_on,
        org_id: item.org_id,
        asset_details: {
          asset_id: item.asset_id,
          asset_name: item.asset_name,
          asset_serial_number: item.asset_serial_number,
          purchased_on: item.purchased_on,
          expiry_date: item.expiry_date,
          current_status: item.current_status
        },
        asset_type_details: {
          asset_type_id: item.asset_type_id,
          asset_type_name: item.asset_type_name,
          assignment_type: item.assignment_type,
          maint_required: item.maint_required,
          inspection_required: item.inspection_required,
          group_required: item.group_required
        }
      }));

      res.json({
        success: true,
        data: formattedData,
        total: formattedData.length,
        status: status
      });

    } catch (error) {
      console.error('Error in getPrintQueueByStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch print queue by status',
        error: error.message
      });
    }
  }

  // Update print status
  static async updatePrintStatus(req, res) {
    try {
      const orgId = req.user.org_id;
      const { psnqId } = req.params;
      const { status } = req.body;

      console.log(`Updating print status for psnq_id: ${psnqId}, status: ${status}`);

      // Validate required fields
      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      // Update status
      const result = await AssetSerialPrintModel.updatePrintStatus(psnqId, status, orgId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Print queue item not found'
        });
      }

      console.log(`Successfully updated print status for: ${psnqId}`);

      res.json({
        success: true,
        message: 'Print status updated successfully',
        data: result
      });

    } catch (error) {
      console.error('Error in updatePrintStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update print status',
        error: error.message
      });
    }
  }

  // Delete from print queue
  static async deleteFromPrintQueue(req, res) {
    try {
      const orgId = req.user.org_id;
      const { psnqId } = req.params;

      console.log(`Deleting print queue item: ${psnqId}`);

      // Delete from print queue
      const result = await AssetSerialPrintModel.deleteFromPrintQueue(psnqId, orgId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Print queue item not found'
        });
      }

      console.log(`Successfully deleted print queue item: ${psnqId}`);

      res.json({
        success: true,
        message: 'Print queue item deleted successfully',
        data: result
      });

    } catch (error) {
      console.error('Error in deleteFromPrintQueue:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete print queue item',
        error: error.message
      });
    }
  }

  // Get print queue item by ID
  static async getPrintQueueById(req, res) {
    try {
      const orgId = req.user.org_id;
      const { psnqId } = req.params;

      console.log(`Fetching print queue item: ${psnqId}`);

      // Get print queue item
      const result = await AssetSerialPrintModel.getPrintQueueById(psnqId, orgId);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Print queue item not found'
        });
      }

      console.log(`Found print queue item: ${psnqId}`);

      // Format response with asset and asset type details
      const formattedData = {
        psnq_id: result.psnq_id,
        serial_no: result.serial_no,
        status: result.status,
        reason: result.reason,
        created_by: result.created_by,
        created_on: result.created_on,
        org_id: result.org_id,
        asset_details: {
          asset_id: result.asset_id,
          asset_name: result.asset_name,
          asset_serial_number: result.asset_serial_number,
          purchase_date: result.purchase_date,
          warranty_end_date: result.warranty_end_date,
          asset_status: result.asset_status
        },
        asset_type_details: {
          asset_type_id: result.asset_type_id,
          asset_type_name: result.asset_type_name,
          assignment_type: result.assignment_type,
          maint_required: result.maint_required,
          inspection_required: result.inspection_required,
          group_required: result.group_required
        }
      };

      res.json({
        success: true,
        data: formattedData
      });

    } catch (error) {
      console.error('Error in getPrintQueueById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch print queue item',
        error: error.message
      });
    }
  }
}

module.exports = AssetSerialPrintController;
