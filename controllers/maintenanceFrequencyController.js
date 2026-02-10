const MaintenanceFrequencyModel = require('../models/maintenanceFrequencyModel');

class MaintenanceFrequencyController {
  // Get all maintenance frequencies
  static async getAllMaintenanceFrequencies(req, res) {
    try {
      const orgId = req.user.org_id;

      console.log(`Fetching all maintenance frequencies for org: ${orgId}`);

      const frequencies = await MaintenanceFrequencyModel.getAllMaintenanceFrequencies(orgId);
      
      console.log(`Found ${frequencies.length} maintenance frequencies`);

      res.json({
        success: true,
        data: frequencies
      });
    } catch (error) {
      console.error('Error in getAllMaintenanceFrequencies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch maintenance frequencies',
        error: error.message
      });
    }
  }

  // Get maintenance frequencies by asset type
  static async getMaintenanceFrequenciesByAssetType(req, res) {
    try {
      const { assetTypeId } = req.params;
      const orgId = req.user.org_id;

      console.log(`Fetching maintenance frequencies for asset type: ${assetTypeId}, org: ${orgId}`);

      const frequencies = await MaintenanceFrequencyModel.getMaintenanceFrequenciesByAssetType(assetTypeId, orgId);
      
      console.log(`Found ${frequencies.length} maintenance frequencies for asset type ${assetTypeId}`);

      res.json({
        success: true,
        data: frequencies
      });
    } catch (error) {
      console.error('Error in getMaintenanceFrequenciesByAssetType:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch maintenance frequencies',
        error: error.message
      });
    }
  }

  // Get maintenance frequency by ID
  static async getMaintenanceFrequencyById(req, res) {
    try {
      const { id } = req.params;
      const orgId = req.user.org_id;

      console.log(`Fetching maintenance frequency: ${id}`);

      const frequency = await MaintenanceFrequencyModel.getMaintenanceFrequencyById(id, orgId);
      
      if (!frequency) {
        return res.status(404).json({
          success: false,
          message: 'Maintenance frequency not found'
        });
      }

      res.json({
        success: true,
        data: frequency
      });
    } catch (error) {
      console.error('Error in getMaintenanceFrequencyById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch maintenance frequency',
        error: error.message
      });
    }
  }

  // Create maintenance frequency
  static async createMaintenanceFrequency(req, res) {
    try {
      const { asset_type_id, frequency, uom, text, maintained_by, maint_type_id, is_recurring } = req.body;
      const orgId = req.user.org_id;

      if (!asset_type_id) {
        return res.status(400).json({
          success: false,
          message: 'Asset type ID is required'
        });
      }

      // is_recurring defaults to true if not provided
      const isRecurring = is_recurring !== undefined ? Boolean(is_recurring) : true;

      // Validate required fields for recurring maintenance
      if (isRecurring) {
        if (!frequency || isNaN(frequency) || frequency <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Valid frequency is required for recurring maintenance'
          });
        }

        if (!uom || !uom.trim()) {
          return res.status(400).json({
            success: false,
            message: 'Unit of Measure (UOM) is required for recurring maintenance'
          });
        }
      }

      if (!maintained_by) {
        return res.status(400).json({
          success: false,
          message: 'Maintained by (Self/Vendor) is required'
        });
      }

      if (!maint_type_id) {
        return res.status(400).json({
          success: false,
          message: 'Maintenance type is required'
        });
      }

      console.log(`Creating ${isRecurring ? 'recurring' : 'on-demand'} maintenance frequency for asset type: ${asset_type_id}`);
      console.log(`UOM received:`, uom, `Type:`, typeof uom);

      const newFrequency = await MaintenanceFrequencyModel.createMaintenanceFrequency(
        asset_type_id,
        isRecurring ? parseInt(frequency) : null,
        isRecurring && uom ? uom.toString().trim() : null,
        text?.trim() || (isRecurring ? null : 'On Demand'),
        maintained_by,
        maint_type_id,
        orgId,
        isRecurring
      );
      
      console.log(`Successfully created maintenance frequency:`, newFrequency);

      res.status(201).json({
        success: true,
        data: newFrequency,
        message: `${isRecurring ? 'Recurring' : 'On-demand'} maintenance frequency created successfully`
      });
    } catch (error) {
      console.error('Error in createMaintenanceFrequency:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create maintenance frequency',
        error: error.message
      });
    }
  }

  // Update maintenance frequency
  static async updateMaintenanceFrequency(req, res) {
    try {
      const { id } = req.params;
      const { frequency, uom, text, maintained_by, maint_type_id, is_recurring } = req.body;
      const orgId = req.user.org_id;

      // is_recurring defaults to true if not provided
      const isRecurring = is_recurring !== undefined ? Boolean(is_recurring) : true;

      // Validate required fields for recurring maintenance
      if (isRecurring) {
        if (!frequency || isNaN(frequency) || frequency <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Valid frequency is required for recurring maintenance'
          });
        }

        if (!uom || !uom.trim()) {
          return res.status(400).json({
            success: false,
            message: 'Unit of Measure (UOM) is required for recurring maintenance'
          });
        }
      }

      if (!maintained_by) {
        return res.status(400).json({
          success: false,
          message: 'Maintained by (Self/Vendor) is required'
        });
      }

      if (!maint_type_id) {
        return res.status(400).json({
          success: false,
          message: 'Maintenance type is required'
        });
      }

      console.log(`Updating maintenance frequency ${id} (${isRecurring ? 'recurring' : 'on-demand'})`);

      const updatedFrequency = await MaintenanceFrequencyModel.updateMaintenanceFrequency(
        id,
        isRecurring ? parseInt(frequency) : null,
        isRecurring && uom ? uom.trim() : null,
        text?.trim() || (isRecurring ? null : 'On Demand'),
        maintained_by,
        maint_type_id,
        orgId,
        isRecurring
      );
      
      if (!updatedFrequency) {
        return res.status(404).json({
          success: false,
          message: 'Maintenance frequency not found'
        });
      }

      res.json({
        success: true,
        data: updatedFrequency,
        message: `${isRecurring ? 'Recurring' : 'On-demand'} maintenance frequency updated successfully`
      });
    } catch (error) {
      console.error('Error in updateMaintenanceFrequency:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update maintenance frequency',
        error: error.message
      });
    }
  }

  // Delete maintenance frequency
  static async deleteMaintenanceFrequency(req, res) {
    try {
      const { id } = req.params;
      const orgId = req.user.org_id;

      console.log(`Deleting maintenance frequency ${id}`);

      const deletedFrequency = await MaintenanceFrequencyModel.deleteMaintenanceFrequency(id, orgId);
      
      if (!deletedFrequency) {
        return res.status(404).json({
          success: false,
          message: 'Maintenance frequency not found'
        });
      }

      res.json({
        success: true,
        message: 'Maintenance frequency deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteMaintenanceFrequency:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete maintenance frequency',
        error: error.message
      });
    }
  }

  // Get checklist items for a maintenance frequency
  static async getChecklistItems(req, res) {
    try {
      const { id } = req.params;
      const orgId = req.user.org_id;

      console.log(`Fetching checklist items for maintenance frequency: ${id}`);

      const checklistItems = await MaintenanceFrequencyModel.getChecklistItems(id, orgId);
      
      res.json({
        success: true,
        data: checklistItems
      });
    } catch (error) {
      console.error('Error in getChecklistItems:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch checklist items',
        error: error.message
      });
    }
  }

  // Add checklist item
  static async addChecklistItem(req, res) {
    try {
      const { id } = req.params;
      const { asset_type_id, text } = req.body;
      const orgId = req.user.org_id;

      if (!asset_type_id) {
        return res.status(400).json({
          success: false,
          message: 'Asset type ID is required'
        });
      }

      if (!text || !text.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Checklist item text is required'
        });
      }

      console.log(`Adding checklist item to maintenance frequency: ${id}`);

      const newItem = await MaintenanceFrequencyModel.addChecklistItem(
        asset_type_id,
        id,
        text.trim(),
        orgId
      );
      
      res.status(201).json({
        success: true,
        data: newItem,
        message: 'Checklist item added successfully'
      });
    } catch (error) {
      console.error('Error in addChecklistItem:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add checklist item',
        error: error.message
      });
    }
  }

  // Delete checklist item
  static async deleteChecklistItem(req, res) {
    try {
      const { id, itemId } = req.params;
      const orgId = req.user.org_id;

      console.log(`Deleting checklist item ${itemId} from maintenance frequency: ${id}`);

      const deletedItem = await MaintenanceFrequencyModel.deleteChecklistItem(itemId, orgId);
      
      if (!deletedItem) {
        return res.status(404).json({
          success: false,
          message: 'Checklist item not found'
        });
      }

      res.json({
        success: true,
        message: 'Checklist item deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteChecklistItem:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete checklist item',
        error: error.message
      });
    }
  }
}

module.exports = MaintenanceFrequencyController;

