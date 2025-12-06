const AssetSerialPrintModel = require('../models/assetSerialPrintModel');
const serialPrintLogger = require('../eventLoggers/serialNumberPrintEventLogger');

class AssetSerialPrintController {
  // Add serial number to print queue
  static async addToPrintQueue(req, res) {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
      const orgId = req.user.org_id;
      const createdBy = req.user.user_id;

      const {
        serial_no,
        status = 'pending',
        reason = null
      } = req.body;

      // STEP 1: Log add to queue initiated (non-blocking)
      serialPrintLogger.logAddToPrintQueueInitiated({
        serialNumber: serial_no,
        userId
      }).catch(err => console.error('Logging error:', err));

      // STEP 2: Validate required fields
      if (!serial_no) {
        serialPrintLogger.logMissingParameters({
          operation: 'addToPrintQueue',
          missingParams: ['serial_no'],
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
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

      // STEP 3: Log inserting to database (non-blocking)
      serialPrintLogger.logInsertingToPrintQueue({
        serialNumber: serial_no,
        userId
      }).catch(err => console.error('Logging error:', err));

      // Add to print queue
      const result = await AssetSerialPrintModel.addToPrintQueue(serialData);

      // STEP 4: Log added successfully (non-blocking)
      serialPrintLogger.logAddedToPrintQueue({
        psnqId: result.psnq_id,
        serialNumber: serial_no,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));

      res.status(201).json({
        success: true,
        message: 'Serial number added to print queue successfully',
        data: result
      });

    } catch (error) {
      console.error('Error in addToPrintQueue:', error);
      
      // Handle specific database errors
      if (error.code === '23505') {
        serialPrintLogger.logDuplicateSerialNumber({
          serialNumber: req.body?.serial_no,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        return res.status(409).json({
          success: false,
          message: 'Serial number already exists in print queue',
          error: error.message
        });
      }

      serialPrintLogger.logAddToQueueError({
        serialNumber: req.body?.serial_no,
        error,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));

      res.status(500).json({
        success: false,
        message: 'Failed to add serial number to print queue',
        error: error.message
      });
    }
  }

  // Get all serial numbers in print queue
  static async getAllPrintQueue(req, res) {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
      const orgId = req.user.org_id;
      const branchId = req.user?.branch_id;
      const hasSuperAccess = req.user?.hasSuperAccess || false;

      // STEP 1: Log API called (non-blocking)
      serialPrintLogger.logPrintQueueFetchApiCalled({
        method: req.method,
        url: req.originalUrl,
        status: 'all',
        userId
      }).catch(err => console.error('Logging error:', err));

      // STEP 2: Log querying database (non-blocking)
      serialPrintLogger.logQueryingPrintQueue({
        status: 'all',
        userId
      }).catch(err => console.error('Logging error:', err));

      const printQueue = await AssetSerialPrintModel.getAllPrintQueue(orgId, branchId, hasSuperAccess);

      const count = printQueue.length;

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

      // STEP 3: Log print queue retrieved (non-blocking)
      serialPrintLogger.logPrintQueueRetrieved({
        count,
        status: 'all',
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));

      res.json({
        success: true,
        data: formattedData,
        total: formattedData.length
      });

    } catch (error) {
      console.error('Error in getAllPrintQueue:', error);
      
      serialPrintLogger.logPrintQueueFetchError({
        status: 'all',
        error,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch print queue',
        error: error.message
      });
    }
  }

  // Get print queue by status
  static async getPrintQueueByStatus(req, res) {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
      const orgId = req.user.org_id;
      const branchId = req.user?.branch_id;
      const hasSuperAccess = req.user?.hasSuperAccess || false;
      const { status } = req.params;

      // STEP 1: Log API called (non-blocking)
      serialPrintLogger.logPrintQueueFetchApiCalled({
        method: req.method,
        url: req.originalUrl,
        status,
        userId
      }).catch(err => console.error('Logging error:', err));

      // STEP 2: Log querying database (non-blocking)
      serialPrintLogger.logQueryingPrintQueue({
        status,
        userId
      }).catch(err => console.error('Logging error:', err));

      const printQueue = await AssetSerialPrintModel.getPrintQueueByStatus(orgId, status, branchId, hasSuperAccess);

      const count = printQueue.length;

      // Log if queue is empty (WARNING)
      if (count === 0) {
        serialPrintLogger.logEmptyPrintQueue({
          status,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
      }

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

      // STEP 3: Log print queue retrieved (non-blocking)
      serialPrintLogger.logPrintQueueRetrieved({
        count,
        status,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));

      res.json({
        success: true,
        data: formattedData,
        total: formattedData.length,
        status: status
      });

    } catch (error) {
      console.error('Error in getPrintQueueByStatus:', error);
      
      serialPrintLogger.logPrintQueueFetchError({
        status: req.params?.status,
        error,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch print queue by status',
        error: error.message
      });
    }
  }

  // Update print status
  static async updatePrintStatus(req, res) {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
      const orgId = req.user.org_id;
      const { psnqId } = req.params;
      const { status } = req.body;

      // STEP 1: Log status update API called (non-blocking)
      serialPrintLogger.logStatusUpdateApiCalled({
        method: req.method,
        url: req.originalUrl,
        psnqId,
        newStatus: status,
        userId
      }).catch(err => console.error('Logging error:', err));

      // STEP 2: Validate required fields
      if (!status) {
        serialPrintLogger.logMissingParameters({
          operation: 'updatePrintStatus',
          missingParams: ['status'],
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      // STEP 3: Log updating status in database (non-blocking)
      serialPrintLogger.logUpdatingStatusInDatabase({
        psnqId,
        newStatus: status,
        userId
      }).catch(err => console.error('Logging error:', err));

      // Update status
      const result = await AssetSerialPrintModel.updatePrintStatus(psnqId, status, orgId);

      if (!result) {
        serialPrintLogger.logPrintQueueItemNotFound({
          psnqId,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        return res.status(404).json({
          success: false,
          message: 'Print queue item not found'
        });
      }

      // STEP 4: Log status updated successfully (non-blocking)
      serialPrintLogger.logStatusUpdated({
        psnqId,
        serialNumber: result.serial_no || 'unknown',
        newStatus: status,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));

      res.json({
        success: true,
        message: 'Print status updated successfully',
        data: result
      });

    } catch (error) {
      console.error('Error in updatePrintStatus:', error);
      
      serialPrintLogger.logStatusUpdateError({
        psnqId: req.params?.psnqId,
        newStatus: req.body?.status,
        error,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
      
      res.status(500).json({
        success: false,
        message: 'Failed to update print status',
        error: error.message
      });
    }
  }

  // Delete from print queue
  static async deleteFromPrintQueue(req, res) {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
      const orgId = req.user.org_id;
      const { psnqId } = req.params;

      // STEP 1: Log delete initiated (non-blocking)
      serialPrintLogger.logDeleteFromQueueInitiated({
        psnqId,
        userId
      }).catch(err => console.error('Logging error:', err));

      // Delete from print queue
      const result = await AssetSerialPrintModel.deleteFromPrintQueue(psnqId, orgId);

      if (!result) {
        serialPrintLogger.logPrintQueueItemNotFound({
          psnqId,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        return res.status(404).json({
          success: false,
          message: 'Print queue item not found'
        });
      }

      // STEP 2: Log deleted successfully (non-blocking)
      serialPrintLogger.logDeletedFromQueue({
        psnqId,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));

      res.json({
        success: true,
        message: 'Print queue item deleted successfully',
        data: result
      });

    } catch (error) {
      console.error('Error in deleteFromPrintQueue:', error);
      
      serialPrintLogger.logDeleteError({
        psnqId: req.params?.psnqId,
        error,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));
      
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
