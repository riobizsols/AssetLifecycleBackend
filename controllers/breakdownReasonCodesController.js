const BreakdownReasonCodesModel = require('../models/breakdownReasonCodesModel');

class BreakdownReasonCodesController {
  // Get all breakdown reason codes
  static async getAllReasonCodes(req, res) {
    try {
      const orgId = req.user.org_id;

      console.log(`Fetching all breakdown reason codes for org: ${orgId}`);

      const reasonCodes = await BreakdownReasonCodesModel.getAllReasonCodes(orgId);
      
      console.log(`Found ${reasonCodes.length} breakdown reason codes`);

      res.json({
        success: true,
        data: reasonCodes
      });
    } catch (error) {
      console.error('Error in getAllReasonCodes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch breakdown reason codes',
        error: error.message
      });
    }
  }

  // Get breakdown reason codes by asset type
  static async getReasonCodesByAssetType(req, res) {
    try {
      const { assetTypeId } = req.params;
      const orgId = req.user.org_id;

      console.log(`Fetching breakdown reason codes for asset type: ${assetTypeId}, org: ${orgId}`);

      const reasonCodes = await BreakdownReasonCodesModel.getReasonCodesByAssetType(assetTypeId, orgId);
      
      console.log(`Found ${reasonCodes.length} breakdown reason codes for asset type ${assetTypeId}`);

      res.json({
        success: true,
        data: reasonCodes
      });
    } catch (error) {
      console.error('Error in getReasonCodesByAssetType:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch breakdown reason codes',
        error: error.message
      });
    }
  }

  // Create a new breakdown reason code
  static async createReasonCode(req, res) {
    try {
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
          message: 'Reason code text is required'
        });
      }

      console.log(`Creating breakdown reason code: ${text} for asset type: ${asset_type_id}`);

      const newReasonCode = await BreakdownReasonCodesModel.createReasonCode(asset_type_id, text, orgId);
      
      console.log(`Successfully created breakdown reason code:`, newReasonCode);

      res.status(201).json({
        success: true,
        data: newReasonCode,
        message: 'Breakdown reason code created successfully'
      });
    } catch (error) {
      console.error('Error in createReasonCode:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create breakdown reason code',
        error: error.message
      });
    }
  }

  // Update breakdown reason code
  static async updateReasonCode(req, res) {
    try {
      const { id } = req.params;
      const { text } = req.body;
      const orgId = req.user.org_id;

      if (!text || !text.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Reason code text is required'
        });
      }

      console.log(`Updating breakdown reason code ${id}: ${text}`);

      const updatedReasonCode = await BreakdownReasonCodesModel.updateReasonCode(id, text, orgId);
      
      if (!updatedReasonCode) {
        return res.status(404).json({
          success: false,
          message: 'Breakdown reason code not found'
        });
      }

      res.json({
        success: true,
        data: updatedReasonCode,
        message: 'Breakdown reason code updated successfully'
      });
    } catch (error) {
      console.error('Error in updateReasonCode:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update breakdown reason code',
        error: error.message
      });
    }
  }

  // Delete breakdown reason code
  static async deleteReasonCode(req, res) {
    try {
      const { id } = req.params;
      const orgId = req.user.org_id;

      console.log(`Deleting breakdown reason code ${id}`);

      const deletedReasonCode = await BreakdownReasonCodesModel.deleteReasonCode(id, orgId);
      
      if (!deletedReasonCode) {
        return res.status(404).json({
          success: false,
          message: 'Breakdown reason code not found'
        });
      }

      res.json({
        success: true,
        message: 'Breakdown reason code deleted successfully'
      });
    } catch (error) {
      console.error('Error in deleteReasonCode:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete breakdown reason code',
        error: error.message
      });
    }
  }
}

module.exports = BreakdownReasonCodesController;

